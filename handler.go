package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"image"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strings"
	"sync/atomic"

	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"github.com/publira/epub"
	_ "golang.org/x/image/webp"
)

type ConfigResponse struct {
	MaxUploadMB      int64 `json:"maxUploadMB"`
	MaxPages         int   `json:"maxPages"`
	MaxAssetBytes    int64 `json:"maxAssetBytes"`
	MaxImagePixels   int64 `json:"maxImagePixels"`
	RequestTimeoutMs int64 `json:"requestTimeoutMs"`
}

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type BuildRequest struct {
	Title     string
	Direction string
	Layout    string
	Spread    string
}

var isReady atomic.Bool

func init() {
	isReady.Store(true)
}

func setReady(ready bool) {
	isReady.Store(ready)
}

func parseBuildRequest(r *http.Request) BuildRequest {
	req := BuildRequest{
		Title:     r.FormValue("title"),
		Direction: r.FormValue("direction"),
		Layout:    r.FormValue("layout"),
		Spread:    r.FormValue("spread"),
	}

	if req.Title == "" {
		req.Title = "Untitled"
	}
	if req.Direction == "" {
		req.Direction = "rtl"
	}
	if req.Layout == "" {
		req.Layout = "pre-paginated"
	}
	if req.Spread == "" {
		req.Spread = "right"
	}

	return req
}

func handleLivez(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func handleReadyz(w http.ResponseWriter, _ *http.Request) {
	if !isReady.Load() {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	maxSizeMB := getMaxUploadSize() / (1024 * 1024)
	maxPages := getMaxPages()
	maxAssetBytes := getMaxAssetSizeBytes()
	maxImagePixels := getMaxImagePixels()
	requestTimeoutMs := getRequestTimeout().Milliseconds()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ConfigResponse{
		MaxUploadMB:      maxSizeMB,
		MaxPages:         maxPages,
		MaxAssetBytes:    maxAssetBytes,
		MaxImagePixels:   maxImagePixels,
		RequestTimeoutMs: requestTimeoutMs,
	})
}

func writeJSONError(w http.ResponseWriter, status int, code string, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{
		Code:    code,
		Message: message,
	})
}

func handleExtract(w http.ResponseWriter, r *http.Request) {
	file, header, err := r.FormFile("epub")
	if err != nil {
		slog.Warn("extract: missing epub file", "error", err)
		writeJSONError(w, http.StatusBadRequest, "missing_epub_file", "Failed to get EPUB file.")
		return
	}
	defer file.Close()

	slog.Info("extract: start", "filename", header.Filename, "size", header.Size)

	size, err := getFileSize(file)
	if err != nil {
		slog.Error("extract: failed to get file size", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "read_epub_size_failed", "Failed to read EPUB file size.")
		return
	}

	doc, err := epub.Decode(file, size)
	if err != nil {
		slog.Warn("extract: failed to decode epub", "filename", header.Filename, "error", err)
		writeJSONError(w, http.StatusBadRequest, "invalid_epub", "Failed to decode EPUB.")
		return
	}

	maxPages := getMaxPages()
	if maxPages > 0 && len(doc.Pages) > maxPages {
		slog.Warn("extract: too many pages", "filename", header.Filename, "pages", len(doc.Pages), "maxPages", maxPages)
		writeJSONError(w, http.StatusBadRequest, "page_limit_exceeded", "Page limit exceeded.")
		return
	}

	refs, err := doc.ExtractReferencedImagesFromSpine()
	if err != nil {
		slog.Error("extract: failed to extract images", "filename", header.Filename, "error", err)
		writeJSONError(w, http.StatusInternalServerError, "extract_images_failed", "Failed to extract images.")
		return
	}

	maxAssetSize := getMaxAssetSizeBytes()
	maxImagePixels := getMaxImagePixels()
	pixelCache := make(map[string]int64, len(refs))

	for _, ref := range refs {
		if err := r.Context().Err(); err != nil {
			writeJSONError(w, http.StatusGatewayTimeout, "request_timeout", "Request timed out.")
			return
		}

		assetSize := int64(ref.Asset.Size)
		if maxAssetSize > 0 && assetSize > maxAssetSize {
			slog.Warn("extract: asset size limit exceeded", "filename", header.Filename, "href", ref.Href, "assetSize", assetSize, "maxAssetSize", maxAssetSize)
			writeJSONError(w, http.StatusBadRequest, "asset_size_limit_exceeded", "Asset size limit exceeded.")
			return
		}

		if maxImagePixels > 0 {
			pixels, ok := pixelCache[ref.Href]
			if !ok {
				var pixelErr error
				pixels, pixelErr = getAssetImagePixels(ref.Asset)
				if pixelErr != nil {
					slog.Warn("extract: failed to decode image dimensions", "filename", header.Filename, "href", ref.Href, "error", pixelErr)
					writeJSONError(w, http.StatusBadRequest, "invalid_image", "Failed to parse image dimensions.")
					return
				}
				pixelCache[ref.Href] = pixels
			}

			if pixels > maxImagePixels {
				slog.Warn("extract: image pixels limit exceeded", "filename", header.Filename, "href", ref.Href, "pixels", pixels, "maxPixels", maxImagePixels)
				writeJSONError(w, http.StatusBadRequest, "image_pixels_limit_exceeded", "Image pixel limit exceeded.")
				return
			}
		}
	}

	slog.Info("extract: done", "filename", header.Filename, "images", len(refs))

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="extracted.zip"`)

	zw := zip.NewWriter(w)
	defer zw.Close()

	for _, ref := range refs {
		if err := r.Context().Err(); err != nil {
			writeJSONError(w, http.StatusGatewayTimeout, "request_timeout", "Request timed out.")
			return
		}

		zf, _ := zw.Create(ref.Href)
		rc, _ := ref.Asset.Open()

		io.Copy(zf, rc)
		rc.Close()
	}
}

func handleBuild(w http.ResponseWriter, r *http.Request) {
	req := parseBuildRequest(r)

	files := r.MultipartForm.File["images"]
	if len(files) == 0 {
		slog.Warn("build: no images provided")
		writeJSONError(w, http.StatusBadRequest, "no_images_provided", "No images provided.")
		return
	}

	maxPages := getMaxPages()
	if maxPages > 0 && len(files) > maxPages {
		slog.Warn("build: too many pages", "pages", len(files), "maxPages", maxPages)
		writeJSONError(w, http.StatusBadRequest, "page_limit_exceeded", "Page limit exceeded.")
		return
	}

	slog.Info("build: start", "title", req.Title, "images", len(files), "direction", req.Direction, "spread", req.Spread)

	doc := &epub.Document{
		Metadata:  epub.Metadata{Title: req.Title},
		Direction: req.Direction,
	}

	maxAssetSize := getMaxAssetSizeBytes()
	maxImagePixels := getMaxImagePixels()

	for _, fileHeader := range files {
		if err := r.Context().Err(); err != nil {
			writeJSONError(w, http.StatusGatewayTimeout, "request_timeout", "Request timed out.")
			return
		}

		if maxAssetSize > 0 && fileHeader.Size > maxAssetSize {
			slog.Warn("build: asset size limit exceeded", "filename", fileHeader.Filename, "assetSize", fileHeader.Size, "maxAssetSize", maxAssetSize)
			writeJSONError(w, http.StatusBadRequest, "asset_size_limit_exceeded", "Asset size limit exceeded.")
			return
		}

		f, err := fileHeader.Open()
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "open_image_failed", "Failed to open image.")
			return
		}

		defer f.Close()

		if maxImagePixels > 0 {
			pixels, pixelErr := getMultipartFileImagePixels(f)
			if pixelErr != nil {
				slog.Warn("build: failed to decode image dimensions", "filename", fileHeader.Filename, "error", pixelErr)
				writeJSONError(w, http.StatusBadRequest, "invalid_image", "Failed to parse image dimensions.")
				return
			}

			if pixels > maxImagePixels {
				slog.Warn("build: image pixels limit exceeded", "filename", fileHeader.Filename, "pixels", pixels, "maxPixels", maxImagePixels)
				writeJSONError(w, http.StatusBadRequest, "image_pixels_limit_exceeded", "Image pixel limit exceeded.")
				return
			}
		}

		if _, _, err := doc.AddPageWithAsset(f, fileHeader.Size, req.Spread); err != nil {
			slog.Warn("build: failed to add image", "filename", fileHeader.Filename, "error", err)
			writeJSONError(w, http.StatusBadRequest, "invalid_image", "Failed to add image.")
			return
		}
	}

	w.Header().Set("Content-Type", "application/epub+zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.epub"`, req.Title))

	if err := epub.Encode(w, doc); err != nil {
		slog.Error("build: encode failed", "title", req.Title, "error", err)
		return
	}

	slog.Info("build: done", "title", req.Title)
}

func getFileSize(file multipart.File) (int64, error) {
	currentPos, err := file.Seek(0, io.SeekCurrent)
	if err != nil {
		return 0, err
	}

	endPos, err := file.Seek(0, io.SeekEnd)
	if err != nil {
		return 0, err
	}

	if _, err := file.Seek(currentPos, io.SeekStart); err != nil {
		return 0, err
	}

	return endPos, nil
}

func getMultipartFileImagePixels(file multipart.File) (int64, error) {
	currentPos, err := file.Seek(0, io.SeekCurrent)
	if err != nil {
		return 0, err
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return 0, err
	}

	config, _, err := image.DecodeConfig(file)
	if _, seekErr := file.Seek(currentPos, io.SeekStart); seekErr != nil {
		return 0, seekErr
	}
	if err != nil {
		return 0, err
	}

	return int64(config.Width) * int64(config.Height), nil
}

func getAssetImagePixels(asset *epub.Asset) (int64, error) {
	if asset == nil {
		return 0, fmt.Errorf("asset is nil")
	}

	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(asset.MimeType)), "image/") {
		return 0, nil
	}

	rc, err := asset.Open()
	if err != nil {
		return 0, err
	}
	defer rc.Close()

	config, _, err := image.DecodeConfig(rc)
	if err != nil {
		return 0, err
	}

	return int64(config.Width) * int64(config.Height), nil
}
