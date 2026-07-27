import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, requireAdmin } from "@/lib/session";
import { CLIENT_REGIONS, ROLE_FAMILIES } from "@/lib/openings-taxonomy";

const roleValues = ROLE_FAMILIES.map((r) => r.value) as [string, ...string[]];
const regionValues = CLIENT_REGIONS.map((r) => r.value) as [string, ...string[]];

const Body = z.object({
  jdId: z.string().min(1),
  listed: z.boolean(),
  publicTitle: z.string().trim().max(120).optional(),
  roleFamily: z.enum(roleValues).nullable().optional(),
  industry: z.string().trim().max(80).nullable().optional(),
  clientRegion: z.enum(regionValues).nullable().optional(),
});

/**
 * The "List publicly" control on the admin slate-review screen. The board
 * fails closed (nothing renders without publicTitle + listedAt), so this is
 * the single approval step that puts an opening on /openings.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await parseBody(req, Body);

    const jd = await db.jobDescription.findUnique({
      where: { id: body.jdId },
      select: { id: true, listedAt: true },
    });
    if (!jd) throw new HttpError(404, "Job description not found");

    const publicTitle = body.publicTitle?.trim() || null;
    if (body.listed && !publicTitle) {
      throw new HttpError(400, "A public title is required to list an opening");
    }

    await db.jobDescription.update({
      where: { id: jd.id },
      data: {
        publicTitle,
        roleFamily: body.roleFamily ?? null,
        industry: body.industry?.trim() || null,
        clientRegion: body.clientRegion ?? null,
        // Keep the original listing date on edits; only stamp on first publish.
        listedAt: body.listed ? (jd.listedAt ?? new Date()) : null,
      },
    });

    // This is the one step that can put a client's role in front of the
    // public, so the sanitised title that went out is part of the record —
    // "who listed it" is useless without "as what".
    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: body.listed ? "admin.opening.list" : "admin.opening.unlist",
        target: jd.id,
        meta: { publicTitle },
      },
    });

    return ok({ listed: body.listed });
  } catch (e) {
    return fail(e);
  }
}
