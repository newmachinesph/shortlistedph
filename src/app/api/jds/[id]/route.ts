import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";
import { extractCanonicalTools } from "@/lib/scoring";
import { JdBody, hardRequirementsJson } from "../route";

/** The JD, or 404 — never leak another employer's row as a 403. */
async function ownedJd(id: string, employerId: string) {
  const jd = await db.jobDescription.findUnique({ where: { id } });
  if (!jd || jd.employerId !== employerId) throw new HttpError(404, "Job description not found");
  return jd;
}

/**
 * Edit a draft. Only while status is "draft": once published, the JD has been
 * embedded and candidates have been ranked against it, so a silent rewrite
 * would invalidate every score and every consent already asked for.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const jd = await ownedJd(id, employer.id);
    if (jd.status !== "draft") throw new HttpError(409, "Published job descriptions can't be edited");

    const { rateMaxUsd, ...body } = await parseBody(req, JdBody);
    const updated = await db.jobDescription.update({
      where: { id: jd.id },
      data: {
        ...body,
        hardRequirements: hardRequirementsJson(rateMaxUsd, body.hoursPerWeek),
        // Re-derived, never carried over: the tool IDs describe the CURRENT
        // must/nice-to-haves, exactly as POST derives them.
        requiredTools: extractCanonicalTools(body.mustHaves),
        preferredTools: extractCanonicalTools(body.niceToHaves),
      },
    });
    return ok({ jd: updated });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Close the role. A soft close, not a delete — the slate, its snapshots and the
 * payment trail all have to survive. Allowed from any live state; the terminal
 * "closed" is what stops the public openings board advertising a filled role.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const jd = await ownedJd(id, employer.id);
    if (jd.status === "closed") return ok({ jd });

    const updated = await db.jobDescription.update({
      where: { id: jd.id },
      data: { status: "closed", closedAt: new Date() },
    });
    await db.auditLog.create({ data: { actorId: user.id, action: "jd.close", target: jd.id } });
    return ok({ jd: updated });
  } catch (e) {
    return fail(e);
  }
}
