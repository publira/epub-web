# Contributing

## 技術スタック

- Backend: Go 1.26
- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS 4

## セットアップ

### 前提

- Go 1.26以上
- Node.js 24以上
- npm

### 1. 依存関係のインストール

```bash
go mod download
```

```bash
cd frontend
npm ci
```

### 2. フロントエンドをビルド

`static.go`は`frontend/dist`を埋め込むため、最初にビルドが必要です。

```bash
cd frontend
npm run build
cd ..
```

### 3. 開発サーバーの起動

ターミナルを2つ使います。

```bash
# ターミナル1: backend
go run ./...
```

```bash
# ターミナル2: frontend
cd frontend
npm run dev
```

Viteの開発サーバーは`/api`を`http://localhost:8080`にプロキシします。

## テストとチェック

```bash
# backend
go test ./...
```

```bash
# frontend
cd frontend
npm run test
npm run check
```
