package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

var isReady atomic.Bool

func init() {
	isReady.Store(true)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /livez", handleLivez)
	mux.HandleFunc("GET /readyz", handleReadyz)
	mux.HandleFunc("GET /api/config", handleConfig)
	mux.Handle("POST /api/extract", withOriginCheck(withTimeout(withLimit(handleExtract))))
	mux.Handle("POST /api/build", withOriginCheck(withTimeout(withLimit(handleBuild))))

	mux.Handle("/", withCache(http.FileServer(GetFrontendFS())))

	handler := h2c.NewHandler(withLog(withSecurityHeaders(mux)), &http2.Server{})
	addr := getListenAddress()
	server := &http.Server{
		Addr:    addr,
		Handler: handler,
	}

	errCh := make(chan error, 1)

	go func() {
		slog.Info("server starting", "addr", addr)
		errCh <- server.ListenAndServe()
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(sigCh)

	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server stopped", "error", err)
			os.Exit(1)
		}
	case sig := <-sigCh:
		slog.Info("shutdown signal received", "signal", sig.String())
		setReady(false)

		shutdownTimeout := getShutdownTimeout()
		shutdownCtx := context.Background()
		cancel := func() {}
		if shutdownTimeout > 0 {
			shutdownCtx, cancel = context.WithTimeout(shutdownCtx, shutdownTimeout)
		}
		defer cancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			slog.Error("graceful shutdown failed", "error", err)
			if closeErr := server.Close(); closeErr != nil {
				slog.Error("force close failed", "error", closeErr)
			}
			os.Exit(1)
		}

		if err := <-errCh; err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server stopped", "error", err)
			os.Exit(1)
		}

		slog.Info("server stopped")
	}
}
