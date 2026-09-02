# Frontend Agent Guide

Conventions for `frontend/`, the React SPA that the Go binary embeds.

## Build output

`pnpm build`, from either this directory or the workspace root, writes `dist/`, which `static.go` embeds, so run it before building or testing the backend.

## Dependencies

pnpm, from the workspace root: this directory is the only package in the root `pnpm-workspace.yaml`, which also sets `savePrefix: ""`, so dependencies are pinned with no range.

## Lint and format

ultracite, through `pnpm check` and `pnpm fix` at the workspace root, which cover the Markdown in this directory as well as the source. Suppressions carry a reason (`// oxlint-disable-next-line rule -- why`), and the rules disabled in the root `oxlint.config.ts` are known debts rather than licence to add more.

## React

The React Compiler is enabled in `vite.config.ts`, so do not hand-write `useMemo`, `useCallback`, or `memo` for performance.

## Imports

Shared modules are imported through `#lib/*`. Relative imports stay for siblings in a component directory and for a test importing its own subject.

## Tests

Vitest runs with `globals: false`: import `describe` / `it` / `expect` from `vitest`, and opt into a DOM with a `// @vitest-environment jsdom` comment at the top of the file. Tests sit next to their subject as `*.test.ts` / `*.test.tsx`.
