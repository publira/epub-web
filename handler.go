package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/publira/epub"
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
	Authors   []string
	Direction string
	Layout    string
	Spread    string
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

func handleExtract(w http.ResponseWriter, r *http.Request) {
	file, header, err := r.FormFile("epub")
	if err != nil {
		slog.Warn("extract: missing epub file", "error", err)
		writeJSONError(w, http.StatusBadRequest, "missing_epub_file", "Failed to get EPUB file.")
		return
	}
	defer file.Close()

	slog.Info("extract: start", "filename", header.Filename, "size", header.Size)

	refs, err := extractSpineImageRefs(r.Context(), file, header)
	if err != nil {
		if writeHandledRequestError(w, err) {
			return
		}
		slog.Error("extract: unexpected failure", "filename", header.Filename, "error", err)
		writeJSONError(w, http.StatusInternalServerError, "extract_images_failed", "Failed to extract images.")
		return
	}

	if err := r.Context().Err(); err != nil {
		writeJSONError(w, http.StatusGatewayTimeout, "request_timeout", "Request timed out.")
		return
	}

	slog.Info("extract: checks done", "filename", header.Filename, "images", len(refs))

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="extracted.zip"`)

	if err := writeExtractArchive(r.Context(), w, header.Filename, refs); err != nil {
		return
	}

	slog.Info("extract: done", "filename", header.Filename, "images", len(refs))
}

func handleBuild(w http.ResponseWriter, r *http.Request) {
	req := parseBuildRequest(r)

	files := r.MultipartForm.File["images"]

	slog.Info("build: start", "title", req.Title, "images", len(files), "direction", req.Direction, "spread", req.Spread)

	doc, err := buildDocument(r.Context(), req, files)
	if err != nil {
		if writeHandledRequestError(w, err) {
			return
		}
		slog.Error("build: unexpected failure", "title", req.Title, "error", err)
		writeJSONError(w, http.StatusInternalServerError, "invalid_image", "Failed to add image.")
		return
	}

	if err := r.Context().Err(); err != nil {
		writeJSONError(w, http.StatusGatewayTimeout, "request_timeout", "Request timed out.")
		return
	}

	w.Header().Set("Content-Type", "application/epub+zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.epub"`, req.Title))

	if err := epub.Encode(w, doc); err != nil {
		slog.Error("build: encode failed", "title", req.Title, "error", err)
		return
	}

	slog.Info("build: done", "title", req.Title)
}
