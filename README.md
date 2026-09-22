# EPUB Web

A web application that builds EPUB files from images and extracts the images from EPUB files.

## Features

- **Build**: Generates a fixed-layout EPUB from multiple image files.
- **Extract**: Extracts the images from an existing EPUB file and downloads them as a ZIP file.

The interface is available in English and Japanese. On the first visit it follows the browser's language setting (`Accept-Language`). A language chosen from the on-screen language menu or with `/?lang=ja` or `/?lang=en` is reflected in the URL's `lang` parameter and saved in the browser (localStorage) for later visits.

## Running with Docker

Resource limits, timeouts, and other settings are configured with environment variables.

```bash
docker run --rm -p 8080:8080 \
  -e EPUB_WEB_MAX_UPLOAD_SIZE=64 \
  -e EPUB_WEB_MAX_PAGES=100 \
  -e EPUB_WEB_WORKERS=2 \
  ghcr.io/publira/epub-web:latest
```

### Recommended settings by memory size

Recommended environment variable values for the memory available to the host (for example, the memory allocation of a Cloud Run service). Adjust them to prevent running out of memory (OOM) while processing images.

| Setting | 512MiB (default) | 1GiB | 2GiB |
| :-- | :-- | :-- | :-- |
| `EPUB_WEB_MAX_UPLOAD_SIZE` (MB) | `64` | `128` | `256` |
| `EPUB_WEB_MAX_PAGES` | `100` | `200` | `400` |
| `EPUB_WEB_MAX_ASSET_BYTES` (bytes) | `16777216` | `33554432` | `67108864` |
| `EPUB_WEB_WORKERS` | `2` | `4` | `8` |

### Environment variables

| Variable | Default | Description |
| --- | --: | --- |
| `HOST` | `""` | Host to bind to |
| `PORT` | `8080` | Port to listen on |
| `EPUB_WEB_MAX_UPLOAD_SIZE` | `64` | Maximum upload size (MB). `0` means unlimited |
| `EPUB_WEB_MAX_PAGES` | `100` | Maximum number of pages. `0` means unlimited |
| `EPUB_WEB_MAX_ASSET_BYTES` | `16777216` | Maximum size per file (bytes). `0` means unlimited |
| `EPUB_WEB_MAX_IMAGE_LONG_EDGE` | `2048` | Maximum length of an image's long edge (px). `0` means unlimited |
| `EPUB_WEB_MAX_IMAGE_PIXELS` | `4000000` | Maximum number of pixels in an image (W × H). `0` means unlimited |
| `EPUB_WEB_WORKERS` | `2` | Number of parallel image processing workers. `1` or more |
| `EPUB_WEB_REQUEST_TIMEOUT` | `60s` | Timeout for API requests. `0` means unlimited |
| `EPUB_WEB_SHUTDOWN_TIMEOUT` | `10s` | How long to wait for a graceful shutdown on exit |
| `EPUB_WEB_SUPPORTED_LANGUAGES` | `ja,en` | Languages offered for EPUB metadata (comma-separated). The one matching the interface language is the default; otherwise the first one |
| `EPUB_WEB_PUBLIC_URL` | (unset) | Public URL (for example, `https://epub.example.com`). When set, the `hreflang` `alternate` links are absolute URLs; when unset, they are relative URLs starting with `/` |

## API endpoints

### Health checks

- **`GET /livez`**: Returns `200 OK` while the application is running.
- **`GET /readyz`**: Returns `200 OK` when requests can be accepted, and `503 Service Unavailable` while shutting down or otherwise unable to accept them.

### Configuration

- **`GET /api/config`**: Returns the current limits for client-side validation.

### EPUB building and image extraction

Requests are sent as `multipart/form-data`. Errors are returned as JSON (`{"code": "...", "message": "..."}`).

#### `POST /api/build` (build an EPUB)

- `images`: **[required]** Image files
- `title`: EPUB title
- `direction`: Page progression direction (`rtl` / `ltr`)
- `layout`: Layout (such as `pre-paginated`)
- `spread`: Spread placement (`left` / `right` / `center`)
- `language`: Language code (for example, `ja`)
- `cover`: `true` makes the first image the cover

#### `POST /api/extract` (extract images)

- `epub`: **[required]** EPUB file to extract images from

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the [Apache License 2.0](LICENSE).
