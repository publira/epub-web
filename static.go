package main

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed frontend/dist/*
var frontendAssets embed.FS

func GetFrontendFS() http.FileSystem {
	fsys, err := fs.Sub(frontendAssets, "frontend/dist")
	if err != nil {
		panic(err)
	}

	return http.FS(fsys)
}

func cacheControlForFrontend(path string) (string, bool) {
	if strings.HasPrefix(path, "/assets/") {
		return "public, max-age=31536000, immutable", true
	}

	if path == "/" || path == "/index.html" {
		return "public, max-age=60", true
	}

	return "", false
}
