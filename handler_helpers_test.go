package main

import (
	"bytes"
	"context"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/publira/epub"
)

func TestParseBuildRequest_Defaults(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/build", bytes.NewBuffer(nil))
	req.Header.Set("Content-Type", "multipart/form-data; boundary=unused")

	parsed := parseBuildRequest(req)
	if parsed.Title != "Untitled" {
		t.Fatalf("expected default title %q, got %q", "Untitled", parsed.Title)
	}
	if len(parsed.Authors) != 0 {
		t.Fatalf("expected default authors length %d, got %d", 0, len(parsed.Authors))
	}
	if parsed.Direction != "rtl" {
		t.Fatalf("expected default direction %q, got %q", "rtl", parsed.Direction)
	}
	if parsed.Layout != "pre-paginated" {
		t.Fatalf("expected default layout %q, got %q", "pre-paginated", parsed.Layout)
	}
	if parsed.Spread != "right" {
		t.Fatalf("expected default spread %q, got %q", "right", parsed.Spread)
	}
}

func TestParseBuildRequest_AuthorsAreTrimmed(t *testing.T) {
	body := strings.NewReader("title=Book&authors=%20Alice%20&authors=%20Bob%20")
	req := httptest.NewRequest(http.MethodPost, "/api/build", body)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	parsed := parseBuildRequest(req)
	if len(parsed.Authors) != 2 {
		t.Fatalf("expected 2 authors, got %d", len(parsed.Authors))
	}
	if parsed.Authors[0] != "Alice" || parsed.Authors[1] != "Bob" {
		t.Fatalf("expected authors %q and %q, got %q", "Alice", "Bob", parsed.Authors)
	}
}

func TestAsRequestError_WithWrappedError(t *testing.T) {
	wrapped := errors.Join(errors.New("extra"), newBadRequestError("invalid_image", "Failed to parse image dimensions.", errors.New("decode error")))

	reqErr, ok := asRequestError(wrapped)
	if !ok {
		t.Fatal("expected wrapped requestError to be detected")
	}
	if reqErr.code != "invalid_image" {
		t.Fatalf("expected code %q, got %q", "invalid_image", reqErr.code)
	}
}

func TestBuildDocument_NoImages(t *testing.T) {
	_, err := buildDocument(context.Background(), BuildRequest{Title: "x", Direction: "rtl", Spread: "right"}, nil)
	if err == nil {
		t.Fatal("expected error for no images")
	}

	reqErr, ok := asRequestError(err)
	if !ok {
		t.Fatalf("expected requestError, got %T", err)
	}
	if reqErr.code != "no_images_provided" {
		t.Fatalf("expected code %q, got %q", "no_images_provided", reqErr.code)
	}
}

func TestBuildDocument_AuthorIsOptional(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{testPNG(t)})
	doc, err := buildDocument(context.Background(), BuildRequest{Title: "book", Direction: "rtl", Spread: "right"}, fileHeaders)
	if err != nil {
		t.Fatalf("buildDocument failed: %v", err)
	}

	if len(doc.Metadata.Creators) != 0 {
		t.Fatalf("expected no creators, got %d", len(doc.Metadata.Creators))
	}
}

func TestBuildDocument_SetsAuthorCreators(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{testPNG(t)})
	doc, err := buildDocument(context.Background(), BuildRequest{Title: "book", Authors: []string{"Alice", "Bob"}, Direction: "rtl", Spread: "right"}, fileHeaders)
	if err != nil {
		t.Fatalf("buildDocument failed: %v", err)
	}

	if len(doc.Metadata.Creators) != 2 {
		t.Fatalf("expected 2 creators, got %d", len(doc.Metadata.Creators))
	}
	if doc.Metadata.Creators[0].Name != "Alice" {
		t.Fatalf("expected creator name %q, got %q", "Alice", doc.Metadata.Creators[0].Name)
	}
	if doc.Metadata.Creators[1].Name != "Bob" {
		t.Fatalf("expected creator name %q, got %q", "Bob", doc.Metadata.Creators[1].Name)
	}
}

func TestValidateBuildFiles_RejectsAssetSizeLimit(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_ASSET_BYTES", "10")
	fileHeaders := createImageFileHeaders(t, [][]byte{testPNG(t)})

	err := validateBuildFiles(context.Background(), fileHeaders)
	if err == nil {
		t.Fatal("expected error for asset size limit")
	}

	reqErr, ok := asRequestError(err)
	if !ok {
		t.Fatalf("expected requestError, got %T", err)
	}
	if reqErr.code != "asset_size_limit_exceeded" {
		t.Fatalf("expected code %q, got %q", "asset_size_limit_exceeded", reqErr.code)
	}
}

func TestAddBuildPagesInOrder_PreservesOrder(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{testPNGWithSize(t, 10, 20), testPNGWithSize(t, 30, 40)})
	doc := &epub.Document{Metadata: epub.Metadata{Title: "ordered"}, Direction: "rtl"}

	if err := addBuildPagesInOrder(context.Background(), doc, fileHeaders, "right"); err != nil {
		t.Fatalf("addBuildPagesInOrder failed: %v", err)
	}

	refs, err := doc.ExtractReferencedImagesFromSpine()
	if err != nil {
		t.Fatalf("failed to extract spine refs: %v", err)
	}
	if len(refs) != 2 {
		t.Fatalf("expected %d refs, got %d", 2, len(refs))
	}

	firstPixels, err := getAssetImagePixels(refs[0].Asset)
	if err != nil {
		t.Fatalf("failed to decode first image dimensions: %v", err)
	}
	secondPixels, err := getAssetImagePixels(refs[1].Asset)
	if err != nil {
		t.Fatalf("failed to decode second image dimensions: %v", err)
	}
	if firstPixels != 200 {
		t.Fatalf("expected first image pixels %d, got %d", 200, firstPixels)
	}
	if secondPixels != 1200 {
		t.Fatalf("expected second image pixels %d, got %d", 1200, secondPixels)
	}
}

func TestValidateExtractRefs_RejectsImagePixelsLimit(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_IMAGE_PIXELS", "1")

	imageData := testPNGWithSize(t, 2, 2)
	asset := &epub.Asset{
		MimeType: "image/png",
		Size:     uint64(len(imageData)),
		Open: func() (io.ReadCloser, error) {
			return io.NopCloser(bytes.NewReader(imageData)), nil
		},
	}
	refs := []epub.SpineImageReference{{Href: "item/image/p-001.png", Asset: asset}}

	err := validateExtractRefs(context.Background(), "test.epub", refs)
	if err == nil {
		t.Fatal("expected error for image pixel limit")
	}

	reqErr, ok := asRequestError(err)
	if !ok {
		t.Fatalf("expected requestError, got %T", err)
	}
	if reqErr.code != "image_pixels_limit_exceeded" {
		t.Fatalf("expected code %q, got %q", "image_pixels_limit_exceeded", reqErr.code)
	}
}

func createImageFileHeaders(t *testing.T, images [][]byte) []*multipart.FileHeader {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	for i, imageData := range images {
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
	if err := req.ParseMultipartForm(10 << 20); err != nil {
		t.Fatalf("failed to parse multipart form: %v", err)
	}

	return req.MultipartForm.File["images"]
}
