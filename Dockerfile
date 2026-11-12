FROM --platform=$BUILDPLATFORM node:26.13.1-alpine3.23@sha256:39d8c143e60e99ae98f014bebea1e72fc96d3c9bdf9504bc3a27af5c05bfa39f AS frontend-builder

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

FROM --platform=$BUILDPLATFORM golang:1.27.3-alpine3.23@sha256:5d5113301ffcac84e2bfb20c42648803fecaea6789c89bb9b66884e18cbb30a7 AS go-builder

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
