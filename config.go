package main

import (
	"net"
	"os"
	"strconv"
	"strings"
	"time"
)

const defaultPort = "8080"

const (
	defaultMaxUploadSizeMB  = int64(128)
	defaultMaxPages         = 200
	defaultMaxAssetBytes    = int64(32 * 1024 * 1024)
	defaultMaxImagePixels   = int64(4_000_000)
	defaultMaxImageLongEdge = int64(2048)
	defaultWorkers          = 4
	defaultRequestTimeout   = 60 * time.Second
	defaultShutdownTimeout  = 10 * time.Second
)

var defaultSupportedLanguages = []string{"ja", "en"}

func getListenAddress() string {
	host := os.Getenv("HOST")
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	return net.JoinHostPort(host, port)
}

func getMaxUploadSize() int64 {
	sizeStr := os.Getenv("EPUB_WEB_MAX_UPLOAD_SIZE")
	if sizeStr == "" {
		return defaultMaxUploadSizeMB * 1024 * 1024
	}

	size, err := strconv.ParseInt(sizeStr, 10, 64)
	if err != nil || size < 0 {
		return defaultMaxUploadSizeMB * 1024 * 1024
	}
	if size == 0 {
		return 0
	}

	return size * 1024 * 1024
}

func getMaxPages() int {
	value := os.Getenv("EPUB_WEB_MAX_PAGES")
	if value == "" {
		return defaultMaxPages
	}

	count, err := strconv.Atoi(value)
	if err != nil || count < 0 {
		return defaultMaxPages
	}
	if count == 0 {
		return 0
	}

	return count
}

func getMaxAssetSizeBytes() int64 {
	value := os.Getenv("EPUB_WEB_MAX_ASSET_BYTES")
	if value == "" {
		return defaultMaxAssetBytes
	}

	bytes, err := strconv.ParseInt(value, 10, 64)
	if err != nil || bytes < 0 {
		return defaultMaxAssetBytes
	}
	if bytes == 0 {
		return 0
	}

	return bytes
}

func getMaxImagePixels() int64 {
	value := os.Getenv("EPUB_WEB_MAX_IMAGE_PIXELS")
	if value == "" {
		return defaultMaxImagePixels
	}

	pixels, err := strconv.ParseInt(value, 10, 64)
	if err != nil || pixels < 0 {
		return defaultMaxImagePixels
	}
	if pixels == 0 {
		return 0
	}

	return pixels
}

func getMaxImageLongEdge() int64 {
	value := os.Getenv("EPUB_WEB_MAX_IMAGE_LONG_EDGE")
	if value == "" {
		return defaultMaxImageLongEdge
	}

	px, err := strconv.ParseInt(value, 10, 64)
	if err != nil || px < 0 {
		return defaultMaxImageLongEdge
	}
	if px == 0 {
		return 0
	}

	return px
}

func getRequestTimeout() time.Duration {
	value := os.Getenv("EPUB_WEB_REQUEST_TIMEOUT")
	if value == "" {
		return defaultRequestTimeout
	}

	timeout, err := time.ParseDuration(value)
	if err != nil || timeout < 0 {
		return defaultRequestTimeout
	}
	if timeout == 0 {
		return 0
	}

	return timeout
}

func getWorkerLimit() int {
	value := os.Getenv("EPUB_WEB_WORKERS")
	if value == "" {
		return defaultWorkers
	}

	workers, err := strconv.Atoi(value)
	if err != nil || workers <= 0 {
		return defaultWorkers
	}

	return workers
}

func getShutdownTimeout() time.Duration {
	value := os.Getenv("EPUB_WEB_SHUTDOWN_TIMEOUT")
	if value == "" {
		return defaultShutdownTimeout
	}

	timeout, err := time.ParseDuration(value)
	if err != nil || timeout < 0 {
		return defaultShutdownTimeout
	}
	if timeout == 0 {
		return 0
	}

	return timeout
}

func getSupportedLanguages() []string {
	value := os.Getenv("EPUB_WEB_SUPPORTED_LANGUAGES")
	if value == "" {
		return defaultSupportedLanguages
	}

	var langs []string
	for s := range strings.SplitSeq(value, ",") {
		trimmed := strings.TrimSpace(s)
		if trimmed != "" {
			langs = append(langs, trimmed)
		}
	}
	if len(langs) == 0 {
		return defaultSupportedLanguages
	}

	return langs
}
