import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // AI output and learners' text are shown as plain text only (D159):
  // no raw HTML anywhere, except where a comment says why it's safe.
  { rules: { "react/no-danger": "error" } },
  // Must come last: turns off stylistic rules that conflict with Prettier.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Other checkouts (agents' git worktrees) inside this one.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
