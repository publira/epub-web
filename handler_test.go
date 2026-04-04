package main

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/publira/epub"
)

func decodeErrorResponse(t *testing.T, rec *httptest.ResponseRecorder) ErrorResponse {
	t.Helper()

	if got := rec.Header().Get("Content-Type"); !strings.Contains(got, "application/json") {
		t.Fatalf("expected JSON content type, got %q", got)
	}

	var payload ErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode error response: %v", err)
	}

	return payload
}

func TestHandleExtract_RejectsOverPageLimit(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_PAGES", "1")

	epubBytes := buildTestEPUB(t, 2)
	req := newMultipartRequest(t, "/api/extract", "epub", "test.epub", epubBytes)
	rec := httptest.NewRecorder()

	withLimit(handleExtract).ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
	payload := decodeErrorResponse(t, rec)
	if payload.Code != "page_limit_exceeded" {
		t.Fatalf("expected code %q, got %q", "page_limit_exceeded", payload.Code)
	}
	if payload.Message != "Page limit exceeded." {
		t.Fatalf("expected message %q, got %q", "Page limit exceeded.", payload.Message)
	}
}

func TestHandleConfig_ReturnsLimits(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_UPLOAD_SIZE", "32")
	t.Setenv("EPUB_WEB_MAX_PAGES", "250")
	t.Setenv("EPUB_WEB_MAX_ASSET_BYTES", "5242880")
	t.Setenv("EPUB_WEB_MAX_IMAGE_PIXELS", "12000000")
	t.Setenv("EPUB_WEB_REQUEST_TIMEOUT", "45s")

	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()

	handleConfig(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var payload ConfigResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode config response: %v", err)
	}

	if payload.MaxUploadMB != 32 {
		t.Fatalf("expected maxUploadMB %d, got %d", 32, payload.MaxUploadMB)
	}
	if payload.MaxPages != 250 {
		t.Fatalf("expected maxPages %d, got %d", 250, payload.MaxPages)
	}
	if payload.MaxAssetBytes != 5242880 {
		t.Fatalf("expected maxAssetBytes %d, got %d", 5242880, payload.MaxAssetBytes)
	}
	if payload.MaxImagePixels != 12000000 {
		t.Fatalf("expected maxImagePixels %d, got %d", 12000000, payload.MaxImagePixels)
	}
	if payload.RequestTimeoutMs != 45000 {
		t.Fatalf("expected requestTimeoutMs %d, got %d", 45000, payload.RequestTimeoutMs)
	}
}

func TestHandleBuild_RejectsOverPageLimit(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_PAGES", "1")

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("title", "test"); err != nil {
		t.Fatalf("failed to write title field: %v", err)
	}
	for i := range 2 {
		part, err := writer.CreateFormFile("images", "page.png")
		if err != nil {
			t.Fatalf("failed to create image part: %v", err)
		}
		if _, err := part.Write(testPNG(t)); err != nil {
			t.Fatalf("failed to write image part %d: %v", i, err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/build", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()

	withLimit(handleBuild).ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
	payload := decodeErrorResponse(t, rec)
	if payload.Code != "page_limit_exceeded" {
		t.Fatalf("expected code %q, got %q", "page_limit_exceeded", payload.Code)
	}
	if payload.Message != "Page limit exceeded." {
		t.Fatalf("expected message %q, got %q", "Page limit exceeded.", payload.Message)
	}
}

func TestHandleBuild_RejectsAssetSizeLimit(t *testing.T) {
	imageData := testPNG(t)
	t.Setenv("EPUB_WEB_MAX_ASSET_BYTES", "10")

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("title", "test"); err != nil {
		t.Fatalf("failed to write title field: %v", err)
	}
	part, err := writer.CreateFormFile("images", "page.png")
	if err != nil {
		t.Fatalf("failed to create image part: %v", err)
	}
	if _, err := part.Write(imageData); err != nil {
		t.Fatalf("failed to write image part: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/build", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()

	withLimit(handleBuild).ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
	payload := decodeErrorResponse(t, rec)
	if payload.Code != "asset_size_limit_exceeded" {
		t.Fatalf("expected code %q, got %q", "asset_size_limit_exceeded", payload.Code)
	}
}

func TestHandleBuild_RejectsImagePixelsLimit(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_IMAGE_PIXELS", "1")

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("title", "test"); err != nil {
		t.Fatalf("failed to write title field: %v", err)
	}
	part, err := writer.CreateFormFile("images", "page.png")
	if err != nil {
		t.Fatalf("failed to create image part: %v", err)
	}
	if _, err := part.Write(testPNGWithSize(t, 2, 2)); err != nil {
		t.Fatalf("failed to write image part: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/build", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()

	withLimit(handleBuild).ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
	payload := decodeErrorResponse(t, rec)
	if payload.Code != "image_pixels_limit_exceeded" {
		t.Fatalf("expected code %q, got %q", "image_pixels_limit_exceeded", payload.Code)
	}
}

func TestHandleExtract_RejectsAssetSizeLimit(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_ASSET_BYTES", "10")

	imageData := testPNGWithSize(t, 10, 10)
	epubBytes := buildTestEPUBWithImage(t, imageData, 1)
	req := newMultipartRequest(t, "/api/extract", "epub", "test.epub", epubBytes)
	rec := httptest.NewRecorder()

	withLimit(handleExtract).ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
	payload := decodeErrorResponse(t, rec)
	if payload.Code != "asset_size_limit_exceeded" {
		t.Fatalf("expected code %q, got %q", "asset_size_limit_exceeded", payload.Code)
	}
}

func TestHandleExtract_RejectsImagePixelsLimit(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_IMAGE_PIXELS", "1")

	imageData := testPNGWithSize(t, 2, 2)
	epubBytes := buildTestEPUBWithImage(t, imageData, 1)
	req := newMultipartRequest(t, "/api/extract", "epub", "test.epub", epubBytes)
	rec := httptest.NewRecorder()

	withLimit(handleExtract).ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
	payload := decodeErrorResponse(t, rec)
	if payload.Code != "image_pixels_limit_exceeded" {
		t.Fatalf("expected code %q, got %q", "image_pixels_limit_exceeded", payload.Code)
	}
}

func buildTestEPUB(t *testing.T, pageCount int) []byte {
	t.Helper()
	return buildTestEPUBWithImage(t, testPNG(t), pageCount)
}

func buildTestEPUBWithImage(t *testing.T, imageData []byte, pageCount int) []byte {
	t.Helper()

	doc := &epub.Document{
		Metadata:  epub.Metadata{Title: "test"},
		Direction: "rtl",
	}

	for range pageCount {
		if _, _, err := doc.AddPageWithAsset(bytes.NewReader(imageData), int64(len(imageData)), "right"); err != nil {
			t.Fatalf("failed to add page asset: %v", err)
		}
	}

	var encoded bytes.Buffer
	if err := epub.Encode(&encoded, doc); err != nil {
		t.Fatalf("failed to encode test epub: %v", err)
	}

	return encoded.Bytes()
}

func newMultipartRequest(t *testing.T, path string, fieldName string, filename string, content []byte) *http.Request {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile(fieldName, filename)
	if err != nil {
		t.Fatalf("failed to create multipart file: %v", err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatalf("failed to write multipart content: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, path, body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func testPNG(t *testing.T) []byte {
	t.Helper()
	return testPNGWithSize(t, 1, 1)
}

func testPNGWithSize(t *testing.T, width int, height int) []byte {
	t.Helper()

	img := image.NewNRGBA(image.Rect(0, 0, width, height))
	img.Set(0, 0, color.NRGBA{R: 1, G: 2, B: 3, A: 255})

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("failed to encode png: %v", err)
	}

	return buf.Bytes()
}
