/**
 * Lets Node import the app's own modules directly, so the money paths can be
 * tested against a real database instead of only by the typechecker.
 *
 * Two things stand between plain Node and src/lib/*.ts:
 *   - the `@/…` path alias, which only tsconfig knows about;
 *   - extensionless relative imports (`./api`), which the TS bundler
 *     resolution allows and Node ESM does not.
 *
 * Both are resolution concerns, so both are fixed here rather than by editing
 * every import in the app to suit the test runner.
 *
 * The third obstacle, `import "server-only"`, is NOT handled here: run Node
 * with --conditions=react-server and the package's own export map resolves it
 * to an empty module, exactly as the React Server Components build does.
 *
 *   node --conditions=react-server --import ./scripts/node-resolve.mjs \
 *        --experimental-strip-types --test "src/**\/*.dbtest.ts"
 */
import { registerHooks } from "node:module";
import { statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = pathToFileURL(path.join(process.cwd(), "src") + path.sep).href;

/** Mirrors tsconfig's moduleResolution for the two forms the app actually uses. */
const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function firstThatExists(url) {
  for (const suffix of CANDIDATES) {
    const candidate = url + suffix;
    try {
      // isFile(), not existsSync(): `./api` also matches the DIRECTORY
      // src/app/api, and returning that hands Node a folder to read.
      if (statSync(fileURLToPath(candidate)).isFile()) return candidate;
    } catch {
      /* missing, or not a file: URL — try the next suffix */
    }
  }
  return null;
}

/**
 * The mail templates are the one .tsx file lib/ pulls in, and Node strips types
 * but does not transform JSX, so they resolve to components that render to
 * nothing — see scripts/stubs/email-templates.mjs. Everything else about the
 * email module stays real. Nothing but the test runner loads this file (it is
 * opt-in via --import), so the substitution cannot reach the app.
 */
const EMAIL_TEMPLATES = SRC + "emails/templates";
const EMAIL_STUB = pathToFileURL(
  path.join(import.meta.dirname, "stubs", "email-templates.mjs"),
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const aliased = specifier.startsWith("@/") ? SRC + specifier.slice(2) : specifier;

    if (aliased === EMAIL_TEMPLATES) return { url: EMAIL_STUB, shortCircuit: true };

    // Only relative and aliased specifiers are ours to fix. Bare specifiers are
    // packages and must keep going through Node's normal resolution, or
    // --conditions=react-server would stop being consulted.
    const isOurs = aliased.startsWith(".") || aliased.startsWith(SRC);
    if (isOurs) {
      const base = aliased.startsWith(".")
        ? new URL(aliased, context.parentURL).href
        : aliased;
      const found = firstThatExists(base);
      // No `format` here on purpose: naming it as "module" skips the
      // extension-based detection that turns on type stripping, and every .ts
      // file then reaches the parser with its annotations intact.
      if (found) return { url: found, shortCircuit: true };
    }

    try {
      return nextResolve(aliased, context);
    } catch (e) {
      // `next` ships no exports map, so ESM cannot resolve subpaths the way
      // CJS does — `next/server` has to be spelled `next/server.js` here. The
      // app is bundled by Next and never hits this; only the test runner does.
      if (e?.code === "ERR_MODULE_NOT_FOUND" && !path.extname(aliased)) {
        return nextResolve(`${aliased}.js`, context);
      }
      throw e;
    }
  },
});
