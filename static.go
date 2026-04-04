package main

import (
	"embed"
	"io/fs"
	"net/http"
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
