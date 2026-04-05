package main

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"
)

func firstAssetPath(t *testing.T) string {
	t.Helper()

	entries, err := fs.ReadDir(frontendAssets, "frontend/dist/assets")
	if err != nil {
		t.Fatalf("failed to read embedded assets: %v", err)
	}
	if len(entries) == 0 {
		t.Fatal("expected at least one embedded asset")
	}

	return "/assets/" + entries[0].Name()
}

func TestFrontendCacheControl_Root(t *testing.T) {
	h := withCache(http.FileServer(GetFrontendFS()))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
	if got := rec.Header().Get("Cache-Control"); got != "public, max-age=60" {
		t.Fatalf("expected Cache-Control %q, got %q", "public, max-age=60", got)
	}
}

func TestFrontendCacheControl_Assets(t *testing.T) {
	h := withCache(http.FileServer(GetFrontendFS()))
	req := httptest.NewRequest(http.MethodGet, firstAssetPath(t), nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
	if got := rec.Header().Get("Cache-Control"); got != "public, max-age=31536000, immutable" {
		t.Fatalf("expected Cache-Control %q, got %q", "public, max-age=31536000, immutable", got)
	}
}
