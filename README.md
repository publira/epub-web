# EPUB Web

画像ファイル群からのEPUB生成、およびEPUBからの画像抽出機能を備えたWebアプリケーションです。

## 主な機能

- **Build**: 複数の画像ファイルから、固定レイアウトのEPUBを生成します。
- **Extract**: 既存のEPUBファイルから画像を抽出し、ZIPファイルとしてダウンロードします。

## 起動方法 (Docker)

環境変数を使用して、リソース制限やタイムアウトなどを設定できます。

```bash
docker run --rm -p 8080:8080 \
  -e EPUB_WEB_MAX_UPLOAD_SIZE=64 \
  -e EPUB_WEB_MAX_PAGES=100 \
  -e EPUB_WEB_WORKERS=2 \
  ghcr.io/publira/epub-web:latest
```

### メモリサイズ別の推奨設定

ホスト環境のメモリサイズ (例: Cloud Run のメモリ割り当て) に応じた、環境変数の推奨設定値です。画像処理時のメモリ枯渇 (OOM) を防ぐために調整してください。

| 設定項目                           | 512MiB (デフォルト) | 1GiB       | 2GiB       |
| :--------------------------------- | :------------------ | :--------- | :--------- |
| `EPUB_WEB_MAX_UPLOAD_SIZE` (MB)    | `64`                | `128`      | `256`      |
| `EPUB_WEB_MAX_PAGES`               | `100`               | `200`      | `400`      |
| `EPUB_WEB_MAX_ASSET_BYTES` (bytes) | `16777216`          | `33554432` | `67108864` |
| `EPUB_WEB_WORKERS`                 | `2`                 | `4`        | `8`        |

### 環境変数リファレンス

| 変数名                         |     既定値 | 説明                                           |
| ------------------------------ | ---------: | ---------------------------------------------- |
| `HOST`                         |       `""` | バインドするホスト                             |
| `PORT`                         |     `8080` | リッスンポート                                 |
| `EPUB_WEB_MAX_UPLOAD_SIZE`     |       `64` | 最大アップロードサイズ (MB)。`0`で無制限       |
| `EPUB_WEB_MAX_PAGES`           |      `100` | 最大ページ数。`0`で無制限                      |
| `EPUB_WEB_MAX_ASSET_BYTES`     | `16777216` | 1ファイルあたり最大サイズ (bytes)。`0`で無制限 |
| `EPUB_WEB_MAX_IMAGE_LONG_EDGE` |     `2048` | 画像の長辺上限 (px)。`0`で無制限               |
| `EPUB_WEB_MAX_IMAGE_PIXELS`    |  `4000000` | 画像の最大ピクセル数 (W × H)。`0`で無制限      |
| `EPUB_WEB_WORKERS`             |        `2` | 画像処理の並列ワーカー数。`1`以上              |
| `EPUB_WEB_REQUEST_TIMEOUT`     |      `60s` | APIリクエストのタイムアウト。`0`で無制限       |
| `EPUB_WEB_SHUTDOWN_TIMEOUT`    |      `10s` | 終了時のグレースフルシャットダウン待機時間     |
| `EPUB_WEB_SUPPORTED_LANGUAGES` |    `ja,en` | 対応言語 (カンマ区切り)。先頭がデフォルト      |

## API エンドポイント

### 状態確認

- **`GET /livez`**: アプリケーションが起動していれば `200 OK` を返します。
- **`GET /readyz`**: リクエスト受付可能なら `200 OK`、シャットダウン処理中などは `503 Service Unavailable` を返します。

### 設定の取得

- **`GET /api/config`**: クライアント側のバリデーション用に、現在の制限設定を返します。

### EPUB 生成・画像抽出

リクエストは `multipart/form-data` で送信し、エラー時はJSON (`{"code": "...", "message": "..."}`) が返されます。

#### `POST /api/build` (EPUB 生成)

- `images`: **[必須]** 画像ファイル群
- `title`: EPUBのタイトル
- `direction`: 綴じ方向 (`rtl` / `ltr`)
- `layout`: レイアウト (`pre-paginated` 等)
- `spread`: 見開き設定 (`left` / `right` / `center`)
- `language`: 言語コード (例: `ja`)
- `cover`: `true` を指定すると、1枚目の画像をカバーに設定します

#### `POST /api/extract` (画像抽出)

- `epub`: **[必須]** 抽出対象のEPUBファイル

## 開発に参加する

[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[Apache License 2.0](LICENSE) に基づいて公開されています。
