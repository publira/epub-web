# epub-web

画像からePubを生成し、ePubから画像を抽出できるWebアプリです。

## 主な機能

- 画像ファイル群からePubを生成
- ePubから画像を抽出してZIPをダウンロード

## Docker

```bash
docker build -t epub-web .
docker run --rm -p 8080:8080 epub-web
```

## 環境変数

| 変数名 | 既定値 | 説明 |
|---|---:|---|
| `HOST` | 空文字 | バインドするホスト |
| `PORT` | `8080` | リッスンポート |
| `EPUB_WEB_MAX_UPLOAD_SIZE` | `128` | 最大アップロードサイズ (MB)。`0`で無制限 |
| `EPUB_WEB_MAX_PAGES` | `200` | 最大ページ数。`0`で無制限 |
| `EPUB_WEB_MAX_ASSET_BYTES` | `33554432` | 1ファイルあたり最大サイズ (bytes)。`0`で無制限 |
| `EPUB_WEB_MAX_IMAGE_PIXELS` | `50000000` | 画像の最大ピクセル数 (width × height)。`0`で無制限 |
| `EPUB_WEB_REQUEST_TIMEOUT` | `60s` | APIタイムアウト (Go duration形式)。`0`で無制限 |
| `EPUB_WEB_SHUTDOWN_TIMEOUT` | `10s` | グレースフルシャットダウンの待機時間 (Go duration形式)。`0`で無制限 |

### 起動例

```bash
HOST=0.0.0.0 \
PORT=8080 \
EPUB_WEB_MAX_UPLOAD_SIZE=256 \
EPUB_WEB_MAX_PAGES=2000 \
EPUB_WEB_MAX_ASSET_BYTES=67108864 \
EPUB_WEB_MAX_IMAGE_PIXELS=100000000 \
EPUB_WEB_REQUEST_TIMEOUT=90s \
EPUB_WEB_SHUTDOWN_TIMEOUT=15s \
go run ./...
```

## API

### `GET /livez`

liveness 用に `200 OK` を返します。

### `GET /readyz`

通常時は `200 OK`、シャットダウン開始後は `503 Service Unavailable` を返します。

### `GET /api/config`

制限値を返します。

レスポンス例:

```json
{
  "maxUploadMB": 128,
  "maxPages": 1000,
  "maxAssetBytes": 33554432,
  "maxImagePixels": 50000000,
  "requestTimeoutMs": 60000
}
```

### `POST /api/build`

multipart/form-data:

- `images`: 画像ファイル (複数)
- `title`: 生成するePubタイトル (任意)
- `direction`: `rtl` / `ltr` (任意)
- `layout`: `pre-paginated` など (任意)
- `spread`: `left` / `right` など (任意)

### `POST /api/extract`

multipart/form-data:

- `epub`: 入力ePubファイル

### エラー形式

エラー時はJSONを返します。

```json
{
  "code": "page_limit_exceeded",
  "message": "Page limit exceeded."
}
```

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md)を参照してください。

## ライセンス

[LICENSE](LICENSE)を参照してください。
