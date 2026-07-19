import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { HttpError } from "./session";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Single error funnel: keeps internals out of responses and shapes them consistently. */
export function fail(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid input", issues: e.issues.map((i) => ({ path: i.path, message: i.message })) },
      { status: 422 },
    );
  }
  console.error("[api]", e);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
  return schema.parse(raw);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new HttpError(503, `${name} is not configured`);
  return value;
}
