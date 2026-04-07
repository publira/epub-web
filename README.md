# epub-web

画像からePubを生成し、ePubから画像を抽出できるWebアプリです。

## 主な機能

- 画像ファイル群からePubを生成
- ePubから画像を抽出してZIPをダウンロード

## 環境変数

| 変数名 | 既定値 | 説明 |
|---|---:|---|
| `HOST` | 空文字 | バインドするホスト |
| `PORT` | `8080` | リッスンポート |
| `EPUB_WEB_MAX_UPLOAD_SIZE` | `128` | 最大アップロードサイズ (MB)。`0`で無制限 |
| `EPUB_WEB_MAX_PAGES` | `200` | 最大ページ数。`0`で無制限 |
| `EPUB_WEB_MAX_ASSET_BYTES` | `33554432` | 1ファイルあたり最大サイズ (bytes)。`0`で無制限 |
| `EPUB_WEB_MAX_IMAGE_LONG_EDGE` | `2048` | 画像の長辺上限 (px)。`0`で無制限 |
| `EPUB_WEB_MAX_IMAGE_PIXELS` | `4000000` | 画像の最大ピクセル数 (width × height)。`0`で無制限 |
| `EPUB_WEB_WORKERS` | `4` | 並列処理ワーカー数。`1`以上の整数 |
| `EPUB_WEB_REQUEST_TIMEOUT` | `60s` | APIタイムアウト (Go duration形式)。`0`で無制限 |
| `EPUB_WEB_SHUTDOWN_TIMEOUT` | `10s` | グレースフルシャットダウンの待機時間 (Go duration形式)。`0`で無制限 |
| `EPUB_WEB_SUPPORTED_LANGUAGES` | `ja,en` | 対応言語のカンマ区切りリスト。先頭がデフォルト言語 |

### 起動例

```bash
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e EPUB_WEB_MAX_UPLOAD_SIZE=256 \
  -e EPUB_WEB_MAX_PAGES=2000 \
  -e EPUB_WEB_MAX_ASSET_BYTES=67108864 \
  -e EPUB_WEB_MAX_IMAGE_LONG_EDGE=2048 \
  -e EPUB_WEB_MAX_IMAGE_PIXELS=100000000 \
  -e EPUB_WEB_WORKERS=8 \
  -e EPUB_WEB_REQUEST_TIMEOUT=90s \
  -e EPUB_WEB_SHUTDOWN_TIMEOUT=15s \
  -e EPUB_WEB_SUPPORTED_LANGUAGES=ja,en \
  ghcr.io/publira/epub-web:latest
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
  "maxImageLongEdge": 2048,
  "maxImagePixels": 4000000,
  "requestTimeoutMs": 60000,
  "supportedLanguages": ["ja", "en"]
}
```

### `POST /api/build`

multipart/form-data:

- `images`: 画像ファイル (複数)
- `title`: 生成するePubタイトル (任意)
- `direction`: `rtl` / `ltr` (任意)
- `layout`: `pre-paginated` など (任意)
- `spread`: `left` / `right` など (任意)
- `language`: 言語コード。`EPUB_WEB_SUPPORTED_LANGUAGES` の先頭値がデフォルト (任意)
- `cover`: `true` で1枚目を表紙に設定 (任意)

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
