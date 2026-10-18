# TypeScript review reference

- `strict` + `noUncheckedIndexedAccess` are on: handle `undefined` from index access instead of using `!`.
- No `any`; prefer `unknown` + narrowing or zod parsing. Avoid `as` casts except at well-understood boundaries.
- Use `import type` for type-only imports (`verbatimModuleSyntax`).
- Derive types from zod schemas (`z.infer`) or Drizzle (`$inferSelect`) instead of duplicating interfaces.
- Prefer discriminated unions over boolean flags; exhaustive `switch` with a `never` check.
- Exported functions have explicit return types when they are not obvious.
- No floating promises: `await` them or deliberately `void` them.
