package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestWithLimit_RejectsRequestTooLarge(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_UPLOAD_SIZE", "1")

	body := strings.Repeat("a", 2*1024*1024)
	req := httptest.NewRequest(http.MethodPost, "/api/build", strings.NewReader(body))
	req.Header.Set("Content-Type", "multipart/form-data")
	rec := httptest.NewRecorder()

	called := false
	withLimit(func(http.ResponseWriter, *http.Request) {
		called = true
	}).ServeHTTP(rec, req)

	if called {
		t.Fatalf("next handler should not be called")
	}
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected status %d, got %d", http.StatusRequestEntityTooLarge, rec.Code)
	}

	var payload ErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode error response: %v", err)
	}
	if payload.Code != "request_too_large" {
		t.Fatalf("expected code %q, got %q", "request_too_large", payload.Code)
	}
}

func TestWithLimit_AllowsRequestWithinLimit(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_UPLOAD_SIZE", "2")

	boundary := "test-boundary"
	body := "--" + boundary + "--\r\n"
	req := httptest.NewRequest(http.MethodPost, "/api/build", strings.NewReader(body))
	req.Header.Set("Content-Type", "multipart/form-data; boundary="+boundary)
	rec := httptest.NewRecorder()

	withLimit(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}).ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, rec.Code)
	}
}

func TestWithLog_PassesThroughResponse(t *testing.T) {
	h := withLog(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = io.WriteString(w, "ok")
	}))

	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, rec.Code)
	}
	if body := rec.Body.String(); body != "ok" {
		t.Fatalf("expected body %q, got %q", "ok", body)
	}
}

func TestWithTimeout_RejectsLongRunningRequest(t *testing.T) {
	t.Setenv("EPUB_WEB_REQUEST_TIMEOUT", "10ms")

	h := withTimeout(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(30 * time.Millisecond)
		w.WriteHeader(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/slow", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusGatewayTimeout {
		t.Fatalf("expected status %d, got %d", http.StatusGatewayTimeout, rec.Code)
	}

	var payload ErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode error response: %v", err)
	}
	if payload.Code != "request_timeout" {
		t.Fatalf("expected code %q, got %q", "request_timeout", payload.Code)
	}
}

func TestWithSecurityHeaders_SetsAllHeaders(t *testing.T) {
	h := withSecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	tests := []struct {
		header string
		want   string
	}{
		{"X-Content-Type-Options", "nosniff"},
		{"X-Frame-Options", "DENY"},
		{"Referrer-Policy", "strict-origin-when-cross-origin"},
		{"Strict-Transport-Security", "max-age=63072000; includeSubDomains"},
		{"Cross-Origin-Opener-Policy", "same-origin"},
		{"Cross-Origin-Resource-Policy", "same-origin"},
	}
	for _, tt := range tests {
		t.Run(tt.header, func(t *testing.T) {
			if got := rec.Header().Get(tt.header); got != tt.want {
				t.Fatalf("header %q: expected %q, got %q", tt.header, tt.want, got)
			}
		})
	}

	if got := rec.Header().Get("Content-Security-Policy"); got != "" {
		t.Fatalf("Content-Security-Policy should not be set, got %q", got)
	}

	// Permissions-Policy に制限対象が含まれていることを確認
	pp := rec.Header().Get("Permissions-Policy")
	for _, feature := range []string{"camera=()", "microphone=()", "geolocation=()"} {
		t.Run("Permissions-Policy/"+feature, func(t *testing.T) {
			if !strings.Contains(pp, feature) {
				t.Fatalf("Permissions-Policy missing %q: got %q", feature, pp)
			}
		})
	}
}

func TestWithOriginCheck_AllowsMatchingOrigin(t *testing.T) {
	h := withOriginCheck(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/build", nil)
	req.Host = "example.com"
	req.Header.Set("Origin", "https://example.com")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestWithOriginCheck_BlocksMismatchedOrigin(t *testing.T) {
	h := withOriginCheck(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/build", nil)
	req.Host = "example.com"
	req.Header.Set("Origin", "https://evil.example.com")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, rec.Code)
	}
}

func TestWithOriginCheck_BlocksMissingOriginOnPost(t *testing.T) {
	h := withOriginCheck(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/build", nil)
	req.Host = "example.com"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, rec.Code)
	}
}

func TestWithOriginCheck_AllowsGetWithoutOrigin(t *testing.T) {
	h := withOriginCheck(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}
