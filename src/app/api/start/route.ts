import { z } from "zod";
import { ok, fail, parseBody } from "@/lib/api";
import { prospectCount } from "@/lib/prospect-count";
import { draftCookie, upsertDraft } from "@/lib/job-draft";

/**
 * Public funnel endpoint: saves the anonymous role draft and returns a rough
 * count of matching prospects — a NUMBER, never names. The count is recomputed
 * server-side via prospectCount; a client-supplied count is never trusted.
 */

const Body = z.object({
  title: z.string().trim().max(160).default(""),
  rawText: z.string().trim().max(5000).default(""),
  budgetMax: z.number().min(0).max(500).nullable().optional(),
  hoursPerWeek: z.number().int().min(1).max(80).nullable().optional(),
  mustHaves: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
});

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, Body);

    const skills = [body.rawText, body.title, ...body.mustHaves].filter(Boolean);
    const count = await prospectCount({
      skills,
      budgetMax: body.budgetMax ?? null,
      hoursPerWeek: body.hoursPerWeek ?? null,
    });

    const token = await upsertDraft(
      {
        title: body.title || null,
        rawText: body.rawText || null,
        budgetMax: body.budgetMax ?? null,
        hoursPerWeek: body.hoursPerWeek ?? null,
        mustHaves: body.mustHaves,
      },
      count,
    );

    const res = ok({ count });
    res.cookies.set(draftCookie(token));
    return res;
  } catch (e) {
    return fail(e);
  }
}
