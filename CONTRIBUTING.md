# Contributing

## Tech stack

- Backend: Go 1.26
- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS 4

## Setup

### Prerequisites

- Go 1.26 or later
- Node.js 24 or later
- pnpm

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
