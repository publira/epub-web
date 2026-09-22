# Contributing

## Tech stack

- Backend: Go
- Frontend: React, TypeScript, Vite, Tailwind CSS

## Setup

### Prerequisites

- Go, at the version in the `go` directive of `go.mod`
- Node.js, at the version in `devEngines` of `package.json`
- pnpm, at the version in `packageManager` of `package.json`

### 1. Install dependencies

```bash
go mod download
```

```bash
pnpm install
```

### 2. Build the frontend

`static.go` embeds `frontend/dist`, so the frontend has to be built first.

```bash
pnpm build
```

### 3. Start the development servers

Use two terminals.

```bash
# Terminal 1: backend
go run ./...
```

```bash
# Terminal 2: frontend
pnpm dev
```

The Vite development server proxies `/api` to `http://localhost:8080`.

## Tests and checks

```bash
# backend
go test ./...
```

```bash
# frontend
pnpm test
pnpm check
```
