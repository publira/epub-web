package main

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

type responseStatusWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseStatusWriter) WriteHeader(status int) {
	rw.status = status
	rw.ResponseWriter.WriteHeader(status)
}

func withLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseStatusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rw, r)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rw.status,
			"duration", time.Since(start),
			"remote", r.RemoteAddr,
		)
	})
}

func withLimit(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		maxSize := getMaxUploadSize()
		if maxSize > 0 {
			r.Body = http.MaxBytesReader(w, r.Body, maxSize)
		}

		if err := r.ParseMultipartForm(10 << 20); err != nil {
			slog.Warn("request too large", "remote", r.RemoteAddr, "error", err)
			writeJSONError(w, http.StatusRequestEntityTooLarge, "request_too_large", "Request too large.")
			return
		}

		next.ServeHTTP(w, r)
	}
}

type bufferedResponseWriter struct {
	body        bytes.Buffer
	header      http.Header
	status      int
	wroteHeader bool
	mu          sync.Mutex
}

func newBufferedResponseWriter() *bufferedResponseWriter {
	return &bufferedResponseWriter{
		header: make(http.Header),
		status: http.StatusOK,
	}
}

func (w *bufferedResponseWriter) Header() http.Header {
	return w.header
}

func (w *bufferedResponseWriter) WriteHeader(status int) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.wroteHeader {
		return
	}
	w.status = status
	w.wroteHeader = true
}

func (w *bufferedResponseWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if !w.wroteHeader {
		w.wroteHeader = true
	}
	return w.body.Write(p)
}

func withTimeout(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		timeout := getRequestTimeout()
		if timeout <= 0 {
			next.ServeHTTP(w, r)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()

		bw := newBufferedResponseWriter()
		done := make(chan struct{})

		go func() {
			next.ServeHTTP(bw, r.WithContext(ctx))
			close(done)
		}()

		select {
		case <-done:
			for key, values := range bw.header {
				for _, value := range values {
					w.Header().Add(key, value)
				}
			}
			w.WriteHeader(bw.status)
			_, _ = w.Write(bw.body.Bytes())
		case <-ctx.Done():
			slog.Warn("request timeout", "path", r.URL.Path, "timeout", timeout)
			writeJSONError(w, http.StatusGatewayTimeout, "request_timeout", "Request timed out.")
		}
	}
}
