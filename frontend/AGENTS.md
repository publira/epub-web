# Frontend Agent Guide

Conventions for `frontend/`, the React SPA that the Go binary embeds.

## Build output

`npm run build` writes `dist/`, which `static.go` embeds, so run it before building or testing the backend.

## Dependencies

npm, not pnpm — this is not a workspace. `.npmrc` sets `save-prefix=""`, so dependencies are pinned with no range.

## Lint and format

ultracite, through `npm run check` and `npm run fix`, which cover the Markdown in this directory as well as the source. Suppressions carry a reason (`// oxlint-disable-next-line rule -- why`), and the rules disabled in `oxlint.config.ts` are known debts rather than licence to add more.

## React

The React Compiler is enabled in `vite.config.ts`, so do not hand-write `useMemo`, `useCallback`, or `memo` for performance.

## Imports

Shared modules are imported through `#lib/*`. Relative imports stay for siblings in a component directory and for a test importing its own subject.

## Tests

Vitest runs with `globals: false`: import `describe` / `it` / `expect` from `vitest`, and opt into a DOM with a `// @vitest-environment jsdom` comment at the top of the file. Tests sit next to their subject as `*.test.ts` / `*.test.tsx`.
