/**
 * Accrues affiliate commissions that fulfilment never managed to write.
 *
 * recordCommission runs once, post-commit, and swallows its own failure —
 * fulfilment is idempotent, so nothing ever retries it. It is also skipped when
 * the ReferralConversion or the EmployerAccount did not exist yet at payment
 * time. Either way the affiliate is short $9 and no error survives. This finds
 * paid credit purchases with no commission row and accrues them.
 *
 * Never runs on its own: money is written only with --apply, and only for
 * conversions that are still live. Notifications are not sent (the mail and
 * notify modules are server-only); tell the affiliate by hand, or let the next
 * purchase's email carry the balance.
 *
 *   node --experimental-strip-types scripts/reconcile-commissions.ts
 *   node --experimental-strip-types scripts/reconcile-commissions.ts --apply
 *   DB=prod node --experimental-strip-types scripts/reconcile-commissions.ts --apply
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { commissionFor } from "../src/lib/referral-reward.ts";

config({ path: ".env.local", override: true });

const target = process.env.DB === "prod" ? "prod" : "dev";
const url = target === "prod" ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(`No ${target === "prod" ? "PROD_DATABASE_URL" : "DATABASE_URL"} in .env.local`);
  process.exit(1);
}
const apply = process.argv.includes("--apply");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// PRODUCTS lives behind `server-only` (it reaches interviews.ts and the db), so
// the catalog cannot be imported into a script. Only kind: "credits" ever earns
// — mirrored here, not re-derived. A new credits product belongs in this list.
const EARNING_PURPOSES = ["single", "three_pack"];

async function main() {
  const reward = commissionFor("credits");
  if (!reward) throw new Error("commissionFor('credits') returned nothing — the rule changed");

  const payments = await db.payment.findMany({
    where: { status: "paid", purpose: { in: EARNING_PURPOSES } },
    orderBy: { createdAt: "asc" },
    select: { providerRef: true, userId: true, createdAt: true },
  });
  const paid = await db.referralCommission.findMany({
    where: { paymentId: { in: payments.map((p) => p.providerRef) } },
    select: { paymentId: true },
  });
  const settled = new Set(paid.map((c) => c.paymentId));
  const orphans = payments.filter((p) => !settled.has(p.providerRef));

  let accrued = 0;
  const skipped: string[] = [];

  for (const payment of orphans) {
    // Same two gates recordCommission applies: a referred payer, and one who
    // actually holds an employer account. Neither is an error here — most
    // orphans are simply purchases by employers nobody referred.
    const conversion = await db.referralConversion.findUnique({
      where: { userId: payment.userId },
      select: { id: true, referralId: true, status: true },
    });
    if (!conversion) continue;
    if (conversion.status === "void") {
      skipped.push(`${payment.providerRef}: conversion is void`);
      continue;
    }
    const employer = await db.employerAccount.findUnique({
      where: { userId: payment.userId },
      select: { id: true },
    });
    if (!employer) {
      skipped.push(`${payment.providerRef}: payer has no employer account`);
      continue;
    }

    accrued++;
    if (!apply) {
      console.log(
        `would accrue ${reward.currency} ${reward.amount} for ${payment.providerRef} ` +
          `(paid ${payment.createdAt.toISOString().slice(0, 10)})`,
      );
      continue;
    }

    // Unique paymentId makes a re-run safe even if a webhook accrues the same
    // purchase between the read above and this write.
    try {
      await db.$transaction(async (tx) => {
        await tx.referralCommission.create({
          data: {
            referralId: conversion.referralId,
            conversionId: conversion.id,
            paymentId: payment.providerRef,
            amount: reward.amount,
            currency: reward.currency,
          },
        });
        if (conversion.status === "signed_up") {
          await tx.referralConversion.update({
            where: { id: conversion.id },
            data: { status: "qualified", qualifiedAt: new Date() },
          });
        }
      });
      console.log(`accrued ${reward.currency} ${reward.amount} for ${payment.providerRef}`);
    } catch (e) {
      accrued--;
      skipped.push(`${payment.providerRef}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  for (const line of skipped) console.warn(`skipped ${line}`);
  console.log(
    `${apply ? "Accrued" : "Would accrue"} ${accrued} commission(s) on ${target} ` +
      `(${orphans.length} paid credit purchase(s) without one, ${skipped.length} skipped)` +
      `${apply ? "" : " — re-run with --apply to write"}`,
  );

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
