import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { embed, toVectorLiteral } from "@/lib/openai";
import { buildSlate, jdEmbedText } from "@/lib/matching";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";

/** Publish = embed + match. The JD is never visible to talent at any point. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);

    const jd = await db.jobDescription.findUnique({ where: { id } });
    if (!jd || jd.employerId !== employer.id) throw new HttpError(404, "Job description not found");
    if (jd.status !== "draft") throw new HttpError(409, "Already published");
    if (jd.mustHaves.length === 0) throw new HttpError(422, "Add at least one must-have before publishing");

    const vector = await embed(jdEmbedText(jd));
    await db.$executeRawUnsafe(
      `UPDATE "JobDescription" SET embedding = $1::vector, status = 'matching', "publishedAt" = now() WHERE id = $2`,
      toVectorLiteral(vector),
      jd.id,
    );

    // Small pool for now — run inline. Move to a queue when this outgrows the request timeout.
    const result = await buildSlate(jd.id);

    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
