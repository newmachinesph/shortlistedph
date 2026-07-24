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
- mustHaves are matched against candidate SKILLS. Only skills, tools, and domain
  experience belong there ("Zendesk experience", "customer service experience",
  "bookkeeping"). Keep them few and concrete.
- NEVER put logistics into mustHaves: working hours, timezone, equipment,
  internet connection, quiet workspace, language proficiency, availability.
  Timezone/hours belong in overlap. The rest is table stakes on this platform —
  drop it. A logistics line in mustHaves makes qualified candidates score as
  non-matches.
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

    const draft = Draft.parse(JSON.parse(res.output_text ?? "{}"));
    // The model occasionally infers a reversed range; swap so the pre-filled
    // builder is sane and passes the create endpoint's budgetMin<=budgetMax gate.
    const fixed =
      draft.budgetMin != null && draft.budgetMax != null && draft.budgetMin > draft.budgetMax
        ? { ...draft, budgetMin: draft.budgetMax, budgetMax: draft.budgetMin }
        : draft;
    return ok({ draft: fixed });
  } catch (e) {
    return fail(e);
  }
}
