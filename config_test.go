package main

import (
	"testing"
	"time"
)

func TestGetListenAddress_DefaultPort(t *testing.T) {
	t.Setenv("HOST", "")
	t.Setenv("PORT", "")

	if got := getListenAddress(); got != ":8080" {
		t.Fatalf("expected %q, got %q", ":8080", got)
	}
}

func TestGetListenAddress_HostAndPort(t *testing.T) {
	t.Setenv("HOST", "127.0.0.1")
	t.Setenv("PORT", "9090")

	if got := getListenAddress(); got != "127.0.0.1:9090" {
		t.Fatalf("expected %q, got %q", "127.0.0.1:9090", got)
	}
}

func TestGetMaxUploadSize(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_UPLOAD_SIZE", "8")

	if got := getMaxUploadSize(); got != 8*1024*1024 {
		t.Fatalf("expected %d, got %d", 8*1024*1024, got)
	}
}

func TestGetMaxUploadSize_DefaultWhenUnset(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_UPLOAD_SIZE", "")

	if got := getMaxUploadSize(); got != defaultMaxUploadSizeMB*1024*1024 {
		t.Fatalf("expected %d, got %d", defaultMaxUploadSizeMB*1024*1024, got)
	}
}

func TestGetMaxUploadSize_ZeroMeansUnlimited(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_UPLOAD_SIZE", "0")

	if got := getMaxUploadSize(); got != 0 {
		t.Fatalf("expected %d, got %d", 0, got)
	}
}

func TestGetMaxUploadSize_InvalidReturnsDefault(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_UPLOAD_SIZE", "invalid")

	if got := getMaxUploadSize(); got != defaultMaxUploadSizeMB*1024*1024 {
		t.Fatalf("expected %d, got %d", defaultMaxUploadSizeMB*1024*1024, got)
	}
}

func TestGetMaxPages(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_PAGES", "12")

	if got := getMaxPages(); got != 12 {
		t.Fatalf("expected %d, got %d", 12, got)
	}
}

func TestGetMaxPages_DefaultWhenUnset(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_PAGES", "")

	if got := getMaxPages(); got != defaultMaxPages {
		t.Fatalf("expected %d, got %d", defaultMaxPages, got)
	}
}

func TestGetMaxPages_ZeroMeansUnlimited(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_PAGES", "0")

	if got := getMaxPages(); got != 0 {
		t.Fatalf("expected %d, got %d", 0, got)
	}
}

func TestGetMaxPages_InvalidReturnsDefault(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_PAGES", "-3")

	if got := getMaxPages(); got != defaultMaxPages {
		t.Fatalf("expected %d, got %d", defaultMaxPages, got)
	}
}

func TestGetMaxAssetSizeBytes(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_ASSET_BYTES", "4096")

	if got := getMaxAssetSizeBytes(); got != 4096 {
		t.Fatalf("expected %d, got %d", 4096, got)
	}
}

func TestGetMaxAssetSizeBytes_DefaultWhenUnset(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_ASSET_BYTES", "")

	if got := getMaxAssetSizeBytes(); got != defaultMaxAssetBytes {
		t.Fatalf("expected %d, got %d", defaultMaxAssetBytes, got)
	}
}

func TestGetMaxAssetSizeBytes_ZeroMeansUnlimited(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_ASSET_BYTES", "0")

	if got := getMaxAssetSizeBytes(); got != 0 {
		t.Fatalf("expected %d, got %d", 0, got)
	}
}

func TestGetMaxImagePixels(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_IMAGE_PIXELS", "1000000")

	if got := getMaxImagePixels(); got != 1000000 {
		t.Fatalf("expected %d, got %d", 1000000, got)
	}
}

func TestGetMaxImagePixels_DefaultWhenUnset(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_IMAGE_PIXELS", "")

	if got := getMaxImagePixels(); got != defaultMaxImagePixels {
		t.Fatalf("expected %d, got %d", defaultMaxImagePixels, got)
	}
}

func TestGetMaxImagePixels_ZeroMeansUnlimited(t *testing.T) {
	t.Setenv("EPUB_WEB_MAX_IMAGE_PIXELS", "0")

	if got := getMaxImagePixels(); got != 0 {
		t.Fatalf("expected %d, got %d", 0, got)
	}
}

func TestGetRequestTimeout(t *testing.T) {
	t.Setenv("EPUB_WEB_REQUEST_TIMEOUT", "150ms")

	if got := getRequestTimeout(); got != 150*time.Millisecond {
		t.Fatalf("expected %v, got %v", 150*time.Millisecond, got)
	}
}

func TestGetRequestTimeout_DefaultWhenUnset(t *testing.T) {
	t.Setenv("EPUB_WEB_REQUEST_TIMEOUT", "")

	if got := getRequestTimeout(); got != defaultRequestTimeout {
		t.Fatalf("expected %v, got %v", defaultRequestTimeout, got)
	}
}

func TestGetRequestTimeout_ZeroMeansUnlimited(t *testing.T) {
	t.Setenv("EPUB_WEB_REQUEST_TIMEOUT", "0s")

	if got := getRequestTimeout(); got != 0 {
		t.Fatalf("expected %v, got %v", time.Duration(0), got)
	}
}

func TestGetRequestTimeout_InvalidReturnsDefault(t *testing.T) {
	t.Setenv("EPUB_WEB_REQUEST_TIMEOUT", "invalid")

	if got := getRequestTimeout(); got != defaultRequestTimeout {
		t.Fatalf("expected %v, got %v", defaultRequestTimeout, got)
	}
}

func TestGetShutdownTimeout(t *testing.T) {
	t.Setenv("EPUB_WEB_SHUTDOWN_TIMEOUT", "5s")

	if got := getShutdownTimeout(); got != 5*time.Second {
		t.Fatalf("expected %v, got %v", 5*time.Second, got)
	}
}

func TestGetShutdownTimeout_DefaultWhenUnset(t *testing.T) {
	t.Setenv("EPUB_WEB_SHUTDOWN_TIMEOUT", "")

	if got := getShutdownTimeout(); got != defaultShutdownTimeout {
		t.Fatalf("expected %v, got %v", defaultShutdownTimeout, got)
	}
}

func TestGetShutdownTimeout_ZeroDisablesTimeout(t *testing.T) {
	t.Setenv("EPUB_WEB_SHUTDOWN_TIMEOUT", "0s")

	if got := getShutdownTimeout(); got != 0 {
		t.Fatalf("expected %v, got %v", time.Duration(0), got)
	}
}

func TestGetShutdownTimeout_InvalidReturnsDefault(t *testing.T) {
	t.Setenv("EPUB_WEB_SHUTDOWN_TIMEOUT", "invalid")

	if got := getShutdownTimeout(); got != defaultShutdownTimeout {
		t.Fatalf("expected %v, got %v", defaultShutdownTimeout, got)
	}
}
