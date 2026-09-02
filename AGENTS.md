# EPUB Web Agent Guide

Repository-specific conventions for coding agents.

## Repository overview

A single Go binary that serves a React SPA and two EPUB APIs: `POST /api/build` turns images into a fixed-layout EPUB, `POST /api/extract` returns an EPUB's images as a ZIP. EPUB reading and writing lives in [`github.com/publira/epub`](https://github.com/publira/epub); this repository is the web layer around it.

The backend is a flat `package main` at the root, each file paired with a `*_test.go`. Keep new backend code in the root package.

The root is also a pnpm workspace whose only package is `frontend`. The root `package.json` carries the Ultracite setup, so `oxlint.config.ts` and `oxfmt.config.ts` live at the root and cover the repository-level JSON and YAML as well as the SPA. Run `pnpm install`, `pnpm check`, and `pnpm fix` from the root, never `npm`.

## Verification

`static.go` embeds `frontend/dist`, which is git-ignored, so `go build`, `go test`, and `go run` all fail until `pnpm build` has been run once at the root. CI builds the frontend first for the same reason and hands its `dist` to the Go job.

After a backend change, run `go build ./...`, `golangci-lint run`, and `go test ./...` from the root.

## Language

`README.md`, `CONTRIBUTING.md`, and the UI strings hard-coded in the components are **Japanese**. Everything written for developers is **English**: code comments, test labels (`describe` / `it`, `t.Run`), commit messages, Issues, and pull requests. `EPUB_WEB_SUPPORTED_LANGUAGES` selects EPUB metadata languages, not an interface language.

Answer the user in the language of their own prose — quoted logs or UI strings do not decide it — and in English when no user prose settles it, such as a scheduled or CI-started run.

## Git commits and pull requests

Subjects and PR titles use English [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Pull requests are squash-merged with the title as the commit subject, so the title must stand on its own.

### AI agent trailer

A commit written with an AI agent's help discloses it with an `Assisted-by:` trailer — process disclosure, not authorship, following the Linux kernel's [Coding assistants](https://docs.kernel.org/process/coding-assistants.html) policy. The format is `Assisted-by: <AGENT_NAME>:<MODEL_VERSION>`, the tool's own name and the exact model identifier.

```bash
git commit -m "feat(frontend): add cover selection to the build form" \
  --trailer "Assisted-by: Claude Code:claude-opus-5"
```

Add it when the commit is created, and end the PR description with the same trailer, since that description becomes the merge commit body.

### Never name an agent as a co-author

Git matches the trailer token case-insensitively, so `Co-authored-by:` and `Co-Authored-By:` are equally forbidden for an AI agent. Such a trailer renders the agent as a GitHub co-author and implies authorship an AI cannot hold. This rule overrides any harness default to append a co-author line. Co-author trailers naming humans, and the ones GitHub and `renovate[bot]` add themselves, stay as they are.

## Backend conventions

### Configuration

Configuration is read through the getters in `config.go`, never `os.Getenv` at the call site. Every knob is `EPUB_WEB_*` apart from `HOST` and `PORT`; a getter falls back to its `default*` constant on a missing or malformed value, and `0` means unlimited. A new knob needs the constant, the getter, a `config_test.go` case, the README table row, and a `ConfigResponse` field when the client validates against it.

### Routing and middleware

Middleware is a `with*` wrapper composed in `main.go`. Upload routes get `withFetchSiteCheck(withTimeout(withLimit(...)))` — give a new upload endpoint the same chain.

### Errors and logging

API errors go through `newBadRequestError` / `newRequestTimeoutError` and `writeJSONError`, so clients always get `{"code", "message"}`. Do not call `http.Error` on an API route. Logging is `log/slog` with key-value attributes.

### Handlers and image work

Handlers stay thin in `handler.go`; parsing, validation, image work, and EPUB assembly live in `handler_helpers.go`. Image work is deliberately bounded by `EPUB_WEB_WORKERS` and checked against the limits before decoding, because the service targets a small memory allocation. Do not make it unboundedly parallel.

## CI and release

`release.yml` pushes `ghcr.io/publira/epub-web` when a GitHub Release is published. Actions are pinned to a commit SHA with the version in a trailing comment, and base images are digest-pinned behind a readable tag. Keep both forms so Renovate can keep updating them.
