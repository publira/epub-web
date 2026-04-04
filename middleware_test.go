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
