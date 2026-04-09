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
	if parsed.Language != "ja" {
		t.Fatalf("expected default language %q, got %q", "ja", parsed.Language)
	}
	if parsed.Cover {
		t.Fatalf("expected default cover %v, got %v", false, parsed.Cover)
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

func TestParseBuildRequest_LanguageAndCover(t *testing.T) {
	body := strings.NewReader("title=Book&language=en&cover=true")
	req := httptest.NewRequest(http.MethodPost, "/api/build", body)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	parsed := parseBuildRequest(req)
	if parsed.Language != "en" {
		t.Fatalf("expected language %q, got %q", "en", parsed.Language)
	}
	if !parsed.Cover {
		t.Fatalf("expected cover %v, got %v", true, parsed.Cover)
	}
}

func TestBuildDocument_SetsLanguage(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{testPNG(t)})
	doc, err := buildDocument(context.Background(), BuildRequest{Title: "book", Direction: "rtl", Spread: "right", Language: "ja"}, fileHeaders)
	if err != nil {
		t.Fatalf("buildDocument failed: %v", err)
	}

	if doc.Metadata.Language != "ja" {
		t.Fatalf("expected language %q, got %q", "ja", doc.Metadata.Language)
	}
}

func TestBuildDocument_SetsCover(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{testPNG(t), testPNGWithSize(t, 20, 20)})
	doc, err := buildDocument(context.Background(), BuildRequest{Title: "book", Direction: "rtl", Spread: "right", Language: "ja", Cover: true}, fileHeaders)
	if err != nil {
		t.Fatalf("buildDocument failed: %v", err)
	}

	if doc.Metadata.CoverAssetID == "" {
		t.Fatal("expected CoverAssetID to be set")
	}
	if len(doc.Pages) != 2 {
		t.Fatalf("expected 2 pages, got %d", len(doc.Pages))
	}
	if doc.Pages[0].Type != epub.PageTypeCover {
		t.Fatalf("expected first page type %q, got %q", epub.PageTypeCover, doc.Pages[0].Type)
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

func TestBuildDocument_RejectsInvalidLayout(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{testPNG(t)})
	_, err := buildDocument(context.Background(), BuildRequest{Title: "book", Direction: "rtl", Layout: "fixed", Spread: "right"}, fileHeaders)
	if err == nil {
		t.Fatal("expected error for invalid layout")
	}

	reqErr, ok := asRequestError(err)
	if !ok {
		t.Fatalf("expected requestError, got %T", err)
	}
	if reqErr.code != "invalid_layout" {
		t.Fatalf("expected code %q, got %q", "invalid_layout", reqErr.code)
	}
}

func TestBuildDocument_RejectsInvalidSpread(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{testPNG(t)})
	_, err := buildDocument(context.Background(), BuildRequest{Title: "book", Direction: "rtl", Layout: "pre-paginated", Spread: "none"}, fileHeaders)
	if err == nil {
		t.Fatal("expected error for invalid spread")
	}

	reqErr, ok := asRequestError(err)
	if !ok {
		t.Fatalf("expected requestError, got %T", err)
	}
	if reqErr.code != "invalid_spread" {
		t.Fatalf("expected code %q, got %q", "invalid_spread", reqErr.code)
	}
}

func TestBuildDocument_NormalizesBuildOptions(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{testPNG(t)})
	doc, err := buildDocument(context.Background(), BuildRequest{Title: "book", Direction: "rtl", Layout: " Reflowable ", Spread: " RIGHT "}, fileHeaders)
	if err != nil {
		t.Fatalf("buildDocument failed: %v", err)
	}

	if doc.Layout != epub.LayoutReflowable {
		t.Fatalf("expected layout %v, got %v", epub.LayoutReflowable, doc.Layout)
	}
}

func TestBuildDocument_NormalizesSpreadAndAssignsPages(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{
		testPNGWithSize(t, 10, 10),
		testPNGWithSize(t, 20, 20),
		testPNGWithSize(t, 30, 30),
	})

	doc, err := buildDocument(context.Background(), BuildRequest{
		Title:     "book",
		Direction: "rtl",
		Layout:    " pre-paginated ",
		Spread:    " LEFT ",
	}, fileHeaders)
	if err != nil {
		t.Fatalf("buildDocument failed: %v", err)
	}

	assertPageSpreads(t, doc, []string{"center", "left", "right"})
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

	if err := addBuildPagesInOrder(context.Background(), doc, fileHeaders, "right", false); err != nil {
		t.Fatalf("addBuildPagesInOrder failed: %v", err)
	}

	refs, err := doc.ExtractReferencedImagesFromSpine()
	if err != nil {
		t.Fatalf("failed to extract spine refs: %v", err)
	}
	if len(refs) != 2 {
		t.Fatalf("expected %d refs, got %d", 2, len(refs))
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

func TestAddBuildPagesInOrder_AssignsSpreadFromRight(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{
		testPNGWithSize(t, 10, 10),
		testPNGWithSize(t, 20, 20),
		testPNGWithSize(t, 30, 30),
		testPNGWithSize(t, 40, 40),
	})
	doc := &epub.Document{Metadata: epub.Metadata{Title: "spread-right"}, Direction: "rtl"}

	if err := addBuildPagesInOrder(context.Background(), doc, fileHeaders, "right", false); err != nil {
		t.Fatalf("addBuildPagesInOrder failed: %v", err)
	}

	assertPageSpreads(t, doc, []string{"center", "right", "left", "right"})
}

func TestAddBuildPagesInOrder_AssignsSpreadFromLeft(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{
		testPNGWithSize(t, 10, 10),
		testPNGWithSize(t, 20, 20),
		testPNGWithSize(t, 30, 30),
		testPNGWithSize(t, 40, 40),
	})
	doc := &epub.Document{Metadata: epub.Metadata{Title: "spread-left"}, Direction: "rtl"}

	if err := addBuildPagesInOrder(context.Background(), doc, fileHeaders, "left", false); err != nil {
		t.Fatalf("addBuildPagesInOrder failed: %v", err)
	}

	assertPageSpreads(t, doc, []string{"center", "left", "right", "left"})
}

func TestAddBuildPagesInOrder_AssignsSpreadCenter(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{
		testPNGWithSize(t, 10, 10),
		testPNGWithSize(t, 20, 20),
		testPNGWithSize(t, 30, 30),
	})
	doc := &epub.Document{Metadata: epub.Metadata{Title: "spread-center"}, Direction: "rtl"}

	if err := addBuildPagesInOrder(context.Background(), doc, fileHeaders, "center", false); err != nil {
		t.Fatalf("addBuildPagesInOrder failed: %v", err)
	}

	assertPageSpreads(t, doc, []string{"center", "center", "center"})
}

func TestAddBuildPagesInOrder_LandscapeAutoDetect(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{
		testPNGWithSize(t, 10, 10),
		testPNGWithSize(t, 20, 20),
		testPNGWithSize(t, 60, 30), // landscape
		testPNGWithSize(t, 40, 40),
		testPNGWithSize(t, 50, 50),
	})
	doc := &epub.Document{Metadata: epub.Metadata{Title: "landscape-auto"}, Direction: "rtl"}

	// index 0: portrait (10x10) → logicalPage=0 → center, logicalPage becomes 1
	// index 1: portrait (20x20) → logicalPage=1 → right, logicalPage becomes 2
	// index 2: landscape (60x30) → split right half (right), left half (left), logicalPage becomes 4
	// index 3: portrait (40x40) → logicalPage=4 → left (even), logicalPage becomes 5
	// index 4: portrait (50x50) → logicalPage=5 → right (odd), logicalPage becomes 6
	if err := addBuildPagesInOrder(context.Background(), doc, fileHeaders, "right", false); err != nil {
		t.Fatalf("addBuildPagesInOrder failed: %v", err)
	}

	assertPageSpreads(t, doc, []string{"center", "right", "right", "left", "left", "right"})
}

func TestAddBuildPagesInOrder_LandscapeAtStart(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{
		testPNGWithSize(t, 40, 20), // landscape
		testPNGWithSize(t, 20, 20),
		testPNGWithSize(t, 30, 30),
	})
	doc := &epub.Document{Metadata: epub.Metadata{Title: "landscape-start"}, Direction: "rtl"}

	// index 0: landscape → split right half (right), left half (left), logicalPage becomes 2
	// index 1: portrait → logicalPage=2 → left (even), logicalPage becomes 3
	// index 2: portrait → logicalPage=3 → right (odd), logicalPage becomes 4
	if err := addBuildPagesInOrder(context.Background(), doc, fileHeaders, "right", false); err != nil {
		t.Fatalf("addBuildPagesInOrder failed: %v", err)
	}

	assertPageSpreads(t, doc, []string{"right", "left", "left", "right"})
}

func TestAddBuildPagesInOrder_MultipleLandscape(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{
		testPNGWithSize(t, 10, 10),
		testPNGWithSize(t, 40, 20), // landscape
		testPNGWithSize(t, 30, 30),
		testPNGWithSize(t, 60, 30), // landscape
		testPNGWithSize(t, 50, 50),
	})
	doc := &epub.Document{Metadata: epub.Metadata{Title: "multi-landscape"}, Direction: "rtl"}

	// index 0: portrait (10x10) → logicalPage=0 → center, logicalPage becomes 1
	// index 1: landscape (40x20) → split right half (right), left half (left), logicalPage becomes 3
	// index 2: portrait (30x30) → logicalPage=3 → right (odd), logicalPage becomes 4
	// index 3: landscape (60x30) → split right half (right), left half (left), logicalPage becomes 6
	// index 4: portrait (50x50) → logicalPage=6 → left (even), logicalPage becomes 7
	if err := addBuildPagesInOrder(context.Background(), doc, fileHeaders, "right", false); err != nil {
		t.Fatalf("addBuildPagesInOrder failed: %v", err)
	}

	assertPageSpreads(t, doc, []string{"center", "right", "left", "right", "right", "left", "left"})
}

func TestAddBuildPagesInOrder_LandscapeWithCover(t *testing.T) {
	fileHeaders := createImageFileHeaders(t, [][]byte{
		testPNGWithSize(t, 10, 10),
		testPNGWithSize(t, 20, 20),
		testPNGWithSize(t, 60, 30), // landscape
		testPNGWithSize(t, 40, 40),
	})
	doc := &epub.Document{Metadata: epub.Metadata{Title: "landscape-cover"}, Direction: "rtl"}

	// index 0: cover (skipped)
	// index 1: portrait (20x20) → logicalPage=0 → center, logicalPage becomes 1
	// index 2: landscape (60x30) → split right half (right), left half (left), logicalPage becomes 3
	// index 3: portrait (40x40) → logicalPage=3 → right (odd), logicalPage becomes 4
	if err := addBuildPagesInOrder(context.Background(), doc, fileHeaders, "right", true); err != nil {
		t.Fatalf("addBuildPagesInOrder failed: %v", err)
	}

	if len(doc.Pages) != 5 {
		t.Fatalf("expected 5 pages, got %d", len(doc.Pages))
	}
	if doc.Pages[0].Type != epub.PageTypeCover {
		t.Fatalf("expected first page type %q, got %q", epub.PageTypeCover, doc.Pages[0].Type)
	}
	assertPageSpreads(t, doc, []string{"center", "center", "right", "left", "right"})
}

func TestCalculatePageSpread(t *testing.T) {
	tests := []struct {
		name   string
		index  int
		spread string
		want   string
	}{
		{name: "first page is always center", index: 0, spread: "right", want: "center"},
		{name: "right start odd index", index: 1, spread: "right", want: "right"},
		{name: "right start even index", index: 2, spread: "right", want: "left"},
		{name: "left start odd index", index: 1, spread: "left", want: "left"},
		{name: "left start even index", index: 2, spread: "left", want: "right"},
		{name: "center start odd index", index: 1, spread: "center", want: "center"},
		{name: "center start even index", index: 2, spread: "center", want: "center"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := calculatePageSpread(tt.index, tt.spread)
			if got != tt.want {
				t.Fatalf("expected spread %q, got %q", tt.want, got)
			}
		})
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

func TestValidateBuildFiles_RejectsImageLongEdgeLimit(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_IMAGE_LONG_EDGE", "100")

	fileHeaders := createImageFileHeaders(t, [][]byte{testPNGWithSize(t, 101, 10)})

	err := validateBuildFiles(context.Background(), fileHeaders)
	if err == nil {
		t.Fatal("expected error for image long edge limit")
	}

	reqErr, ok := asRequestError(err)
	if !ok {
		t.Fatalf("expected requestError, got %T", err)
	}
	if reqErr.code != "image_long_edge_limit_exceeded" {
		t.Fatalf("expected code %q, got %q", "image_long_edge_limit_exceeded", reqErr.code)
	}
}

func TestValidateExtractRefs_RejectsImageLongEdgeLimit(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_IMAGE_LONG_EDGE", "1")

	imageData := testPNGWithSize(t, 2, 1)
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
		t.Fatal("expected error for image long edge limit")
	}

	reqErr, ok := asRequestError(err)
	if !ok {
		t.Fatalf("expected requestError, got %T", err)
	}
	if reqErr.code != "image_long_edge_limit_exceeded" {
		t.Fatalf("expected code %q, got %q", "image_long_edge_limit_exceeded", reqErr.code)
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

func assertPageSpreads(t *testing.T, doc *epub.Document, expected []string) {
	t.Helper()

	if len(doc.Pages) != len(expected) {
		t.Fatalf("expected %d pages, got %d", len(expected), len(doc.Pages))
	}

	for i := range expected {
		if doc.Pages[i].Spread != expected[i] {
			t.Fatalf("expected page[%d] spread %q, got %q", i, expected[i], doc.Pages[i].Spread)
		}
	}
}
