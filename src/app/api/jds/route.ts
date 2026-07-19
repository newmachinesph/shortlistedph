import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { requireEmployer, requireRole } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const jds = await db.jobDescription.findMany({
      where: { employerId: employer.id },
      orderBy: { createdAt: "desc" },
      include: {
        slates: {
          orderBy: { deliveredAt: "desc" },
          take: 1,
          select: { id: true, status: true, _count: { select: { entries: true } } },
        },
      },
    });
    return ok({ jds, credits: employer.credits });
  } catch (e) {
    return fail(e);
  }
}

const Body = z.object({
  title: z.string().min(3).max(160),
  budgetMin: z.number().min(0).max(500).nullable().optional(),
  budgetMax: z.number().min(0).max(500).nullable().optional(),
  hoursPerWeek: z.number().int().min(1).max(80).nullable().optional(),
  overlap: z.string().max(120).nullable().optional(),
  mustHaves: z.array(z.string().min(1).max(120)).max(10).default([]),
  niceToHaves: z.array(z.string().min(1).max(120)).max(10).default([]),
  screeningQuestions: z
    .array(
      z.object({
        prompt: z.string().min(1).max(300),
        type: z.enum(["short", "paragraph", "yes_no", "single_choice", "multi_choice", "skill_rating"]),
        options: z.array(z.string().max(120)).max(8).optional(),
      }),
    )
    .max(5)
    .optional(),
  initialInstructions: z.string().max(4000).optional(),
  schedulingUrl: z.string().url().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const body = await parseBody(req, Body);

    const jd = await db.jobDescription.create({
      data: { ...body, employerId: employer.id, status: "draft" },
    });
    return ok({ jd }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
