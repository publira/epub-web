package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
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
	req := newMultipartRequest(t, epubBytes)
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
	setReady(true)
	t.Cleanup(func() { setReady(true) })

	t.Setenv("EPUB_WEB_MAX_UPLOAD_SIZE", "32")
	t.Setenv("EPUB_WEB_MAX_PAGES", "250")
	t.Setenv("EPUB_WEB_MAX_ASSET_BYTES", "5242880")
	t.Setenv("EPUB_WEB_MAX_IMAGE_PIXELS", "12000000")
	t.Setenv("EPUB_WEB_REQUEST_TIMEOUT", "45s")
	t.Setenv("EPUB_WEB_MAX_IMAGE_LONG_EDGE", "1280")

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
	if payload.MaxImageLongEdge != 1280 {
		t.Fatalf("expected maxImageLongEdge %d, got %d", 1280, payload.MaxImageLongEdge)
	}
}

func TestHandleReadyz_ReturnsOKWhenReady(t *testing.T) {
	setReady(true)
	t.Cleanup(func() { setReady(true) })

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()

	handleReadyz(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestHandleReadyz_ReturnsServiceUnavailableWhenShuttingDown(t *testing.T) {
	setReady(false)
	t.Cleanup(func() { setReady(true) })

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()

	handleReadyz(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d", http.StatusServiceUnavailable, rec.Code)
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

func TestHandleBuild_RejectsImageLongEdgeLimit(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_IMAGE_LONG_EDGE", "1")

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("title", "test"); err != nil {
		t.Fatalf("failed to write title field: %v", err)
	}
	part, err := writer.CreateFormFile("images", "page.png")
	if err != nil {
		t.Fatalf("failed to create image part: %v", err)
	}
	if _, err := part.Write(testPNGWithSize(t, 2, 1)); err != nil {
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
	if payload.Code != "image_long_edge_limit_exceeded" {
		t.Fatalf("expected code %q, got %q", "image_long_edge_limit_exceeded", payload.Code)
	}
}

func TestHandleBuild_PreservesPageOrder(t *testing.T) {
	firstImage := testPNGWithSize(t, 10, 20)
	secondImage := testPNGWithSize(t, 30, 40)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("title", "ordered"); err != nil {
		t.Fatalf("failed to write title field: %v", err)
	}
	for i, imageData := range [][]byte{firstImage, secondImage} {
		part, err := writer.CreateFormFile("images", "page.png")
		if err != nil {
			t.Fatalf("failed to create image part %d: %v", i, err)
		}
		if _, err := part.Write(imageData); err != nil {
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

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	doc, err := epub.Decode(bytes.NewReader(rec.Body.Bytes()), int64(rec.Body.Len()))
	if err != nil {
		t.Fatalf("failed to decode built epub: %v", err)
	}
	refs, err := doc.ExtractReferencedImagesFromSpine()
	if err != nil {
		t.Fatalf("failed to extract spine refs: %v", err)
	}
	if len(refs) != 2 {
		t.Fatalf("expected %d extracted refs, got %d", 2, len(refs))
	}
	firstMetrics, err := getAssetImageMetrics(refs[0].Asset)
	if err != nil {
		t.Fatalf("failed to decode first image dimensions: %v", err)
	}
	secondMetrics, err := getAssetImageMetrics(refs[1].Asset)
	if err != nil {
		t.Fatalf("failed to decode second image dimensions: %v", err)
	}
	if firstMetrics.pixels != 200 {
		t.Fatalf("expected first image pixels %d, got %d", 200, firstMetrics.pixels)
	}
	if secondMetrics.pixels != 1200 {
		t.Fatalf("expected second image pixels %d, got %d", 1200, secondMetrics.pixels)
	}
}

func TestHandleBuild_SetsUTF8ContentDisposition(t *testing.T) {
	title := "日本語タイトル"

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("title", title); err != nil {
		t.Fatalf("failed to write title field: %v", err)
	}
	part, err := writer.CreateFormFile("images", "page.png")
	if err != nil {
		t.Fatalf("failed to create image part: %v", err)
	}
	if _, err := part.Write(testPNG(t)); err != nil {
		t.Fatalf("failed to write image part: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/build", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()

	withLimit(handleBuild).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	contentDisposition := rec.Header().Get("Content-Disposition")
	if !strings.Contains(contentDisposition, `filename*=UTF-8''`+url.PathEscape(title+".epub")) {
		t.Fatalf("expected UTF-8 filename* in content disposition, got %q", contentDisposition)
	}
	if !strings.Contains(contentDisposition, `filename="`) {
		t.Fatalf("expected ASCII fallback filename in content disposition, got %q", contentDisposition)
	}
}

func TestHandleExtract_RejectsAssetSizeLimit(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_ASSET_BYTES", "10")

	imageData := testPNGWithSize(t, 10, 10)
	epubBytes := buildTestEPUBWithImage(t, imageData, 1)
	req := newMultipartRequest(t, epubBytes)
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
	req := newMultipartRequest(t, epubBytes)
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

func TestHandleExtract_RejectsImageLongEdgeLimit(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_IMAGE_LONG_EDGE", "1")

	imageData := testPNGWithSize(t, 2, 1)
	epubBytes := buildTestEPUBWithImage(t, imageData, 1)
	req := newMultipartRequest(t, epubBytes)
	rec := httptest.NewRecorder()

	withLimit(handleExtract).ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
	payload := decodeErrorResponse(t, rec)
	if payload.Code != "image_long_edge_limit_exceeded" {
		t.Fatalf("expected code %q, got %q", "image_long_edge_limit_exceeded", payload.Code)
	}
}

func TestHandleExtract_ReturnsZipArchive(t *testing.T) {
	epubBytes := buildTestEPUBWithImages(t, [][]byte{
		testPNGWithSize(t, 10, 20),
		testPNGWithSize(t, 30, 40),
	})
	req := newMultipartRequest(t, epubBytes)
	rec := httptest.NewRecorder()

	withLimit(handleExtract).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); !strings.Contains(got, "application/zip") {
		t.Fatalf("expected zip content type, got %q", got)
	}

	zr, err := zip.NewReader(bytes.NewReader(rec.Body.Bytes()), int64(rec.Body.Len()))
	if err != nil {
		t.Fatalf("failed to read extracted zip: %v", err)
	}
	if len(zr.File) != 2 {
		t.Fatalf("expected %d extracted files, got %d", 2, len(zr.File))
	}
	if zr.File[0].Name != "item/image/p-001.png" {
		t.Fatalf("expected first extracted file %q, got %q", "item/image/p-001.png", zr.File[0].Name)
	}
	if zr.File[1].Name != "item/image/p-002.png" {
		t.Fatalf("expected second extracted file %q, got %q", "item/image/p-002.png", zr.File[1].Name)
	}
	if zr.File[0].UncompressedSize64 == 0 || zr.File[1].UncompressedSize64 == 0 {
		t.Fatalf("expected extracted files to be non-empty")
	}
}

func buildTestEPUB(t *testing.T, pageCount int) []byte {
	t.Helper()
	return buildTestEPUBWithImage(t, testPNG(t), pageCount)
}

func buildTestEPUBWithImages(t *testing.T, images [][]byte) []byte {
	t.Helper()

	doc := &epub.Document{
		Metadata:  epub.Metadata{Title: "test"},
		Direction: "rtl",
	}

	for i, imageData := range images {
		if _, _, err := doc.AddPageWithAsset(bytes.NewReader(imageData), int64(len(imageData)), "right"); err != nil {
			t.Fatalf("failed to add page asset %d: %v", i, err)
		}
	}

	var encoded bytes.Buffer
	if err := epub.Encode(&encoded, doc); err != nil {
		t.Fatalf("failed to encode test epub: %v", err)
	}

	return encoded.Bytes()
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

func newMultipartRequest(t *testing.T, content []byte) *http.Request {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("epub", "test.epub")
	if err != nil {
		t.Fatalf("failed to create multipart file: %v", err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatalf("failed to write multipart content: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/extract", body)
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
