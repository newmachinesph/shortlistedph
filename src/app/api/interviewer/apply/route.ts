import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, requireUser } from "@/lib/session";
import { getInterviewer } from "@/lib/interviews";
import { clampRate } from "@/app/interviewer/queries";

/**
 * Anyone signed in may apply to interview. This only files the application at
 * status "pending" — an admin approves it and assigns the role. The client
 * never sets a role here, and a second application is refused.
 */
const Body = z.object({
  bio: z.string().trim().min(30).max(2000),
  expertise: z.array(z.string().trim().min(1)).min(1).max(20),
  languages: z.array(z.string().trim().min(1)).min(1).max(10),
  yearsExperience: z.number().int().min(0).max(60),
  rateUsd: z.number().positive(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await parseBody(req, Body);

    // One application per person — the status page, not a duplicate row, is the
    // response to someone who already applied.
    if (await getInterviewer(user.id)) {
      throw new HttpError(409, "You have already applied");
    }

    await db.interviewer.create({
      data: {
        userId: user.id,
        bio: body.bio,
        expertise: body.expertise,
        languages: body.languages,
        yearsExperience: body.yearsExperience,
        rateUsd: clampRate(body.rateUsd),
        status: "pending",
      },
    });

    return ok({ status: "pending" });
  } catch (e) {
    return fail(e);
  }
}
