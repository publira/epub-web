FROM --platform=$BUILDPLATFORM node:24.21.0-alpine3.23@sha256:9ec4a2e289874ed0d722e1772ec2de45d2801541db8612f3638b26f128c69ac2 AS frontend-builder

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY locales/package.json ./locales/
RUN pnpm install --frozen-lockfile --filter @publira/epub-web

COPY locales/ ./locales/
COPY frontend/ ./frontend/
RUN pnpm --filter @publira/epub-web run build

FROM --platform=$BUILDPLATFORM golang:1.27.2-alpine3.23@sha256:9e45f0eb4a63ed37ad6e604950407558b7c738e34e015ae77a5d4ad369cde079 AS go-builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -o epub-web .

FROM gcr.io/distroless/static-debian12:latest@sha256:d75cdd72874d4790092fcb1b058493ecf6bb5bf2b2b897045b00ff01d91843f2

WORKDIR /

COPY --from=go-builder /app/epub-web /epub-web

EXPOSE 8080

ENTRYPOINT ["/epub-web"]
