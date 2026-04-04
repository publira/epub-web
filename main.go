package main

import (
	"log/slog"
	"net/http"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /livez", handleLivez)
	mux.HandleFunc("GET /readyz", handleReadyz)
	mux.HandleFunc("GET /api/config", handleConfig)
	mux.HandleFunc("POST /api/extract", withTimeout(withLimit(handleExtract)))
	mux.HandleFunc("POST /api/build", withTimeout(withLimit(handleBuild)))

	mux.Handle("/", http.FileServer(GetFrontendFS()))

	handler := h2c.NewHandler(withLog(mux), &http2.Server{})
	addr := getListenAddress()

	slog.Info("server starting", "addr", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		slog.Error("server stopped", "error", err)
	}
}
