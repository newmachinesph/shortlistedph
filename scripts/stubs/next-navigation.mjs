/**
 * Stand-in for `next/navigation` when the dbtests run.
 *
 * The real module reaches the App Router context, which builds a React context
 * at import time — and under --conditions=react-server, `react` resolves to the
 * server build with no createContext. So merely IMPORTING a lib module that
 * mentions redirect() (lib/admin.ts does) crashes the test runner, before a
 * single line of the logic under test executes.
 *
 * These throw rather than no-op on purpose. In Next these functions never
 * return — they throw to unwind the render — so a test that reaches one is a
 * test whose code path ends in a redirect, and it should fail loudly saying so
 * instead of continuing as if the call had returned.
 *
 * Wired up in scripts/node-resolve.mjs, which nothing but the test runner loads.
 */
function unreachable(name) {
  return (target) => {
    throw new Error(
      `${name}(${target ?? ""}) was called under the test runner. ` +
        `Navigation cannot be exercised outside Next — assert on the branch that leads here instead.`,
    );
  };
}

export const redirect = unreachable("redirect");
export const permanentRedirect = unreachable("permanentRedirect");
export const notFound = unreachable("notFound");
export const forbidden = unreachable("forbidden");
export const unauthorized = unreachable("unauthorized");
