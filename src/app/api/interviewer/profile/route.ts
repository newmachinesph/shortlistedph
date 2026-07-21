import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { requireActingInterviewer, clampRate } from "@/app/interviewer/queries";

/**
 * An active interviewer edits their own profile. Status is never touched here —
 * only an admin moves an account between active and paused.
 */
const Body = z.object({
  bio: z.string().trim().min(30).max(2000),
  expertise: z.array(z.string().trim().min(1)).min(1).max(20),
  languages: z.array(z.string().trim().min(1)).min(1).max(10),
  rateUsd: z.number().positive(),
});

export async function PATCH(req: Request) {
  try {
    const { interviewer } = await requireActingInterviewer();
    const body = await parseBody(req, Body);

    await db.interviewer.update({
      where: { id: interviewer.id },
      data: {
        bio: body.bio,
        expertise: body.expertise,
        languages: body.languages,
        rateUsd: clampRate(body.rateUsd),
      },
    });

    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
