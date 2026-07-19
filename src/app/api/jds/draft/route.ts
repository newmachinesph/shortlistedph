import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { MODELS, openai } from "@/lib/openai";
import { requireRole } from "@/lib/session";

const Body = z.object({ text: z.string().min(20).max(20000) });

const Draft = z.object({
  title: z.string(),
  budgetMin: z.number().nullable(),
  budgetMax: z.number().nullable(),
  hoursPerWeek: z.number().int().nullable(),
  overlap: z.string().nullable(),
  mustHaves: z.array(z.string()).max(6),
  niceToHaves: z.array(z.string()).max(5),
});

const SYSTEM = `You turn an employer's rough description into a structured job description for shortlisted.ph.

This is NEVER shown to candidates — it exists only to drive matching. So:
- mustHaves are hard filters. Keep them few and concrete (tools, domain experience, hard constraints).
- niceToHaves are tiebreakers.
- Budget is USD per hour. Infer only if clearly stated; otherwise null.
- Do not invent requirements the employer did not express.`;

export async function POST(req: Request) {
  try {
    await requireRole("employer");
    const { text } = await parseBody(req, Body);

    const res = await openai().responses.create({
      model: MODELS.extract,
      input: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "job_description",
          schema: z.toJSONSchema(Draft),
          strict: false,
        },
      },
    });

    return ok({ draft: Draft.parse(JSON.parse(res.output_text ?? "{}")) });
  } catch (e) {
    return fail(e);
  }
}
