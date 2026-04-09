package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"sync"

	_ "image/gif"

	"github.com/publira/epub"
	_ "golang.org/x/image/webp"
	"golang.org/x/sync/errgroup"
)

type requestError struct {
	status  int
	code    string
	message string
	err     error
}

type imageMetrics struct {
	pixels   int64
	longEdge int64
}

func (e *requestError) Error() string {
	if e == nil {
		return ""
	}
	if e.err != nil {
		return e.err.Error()
	}
	return e.code
}

func (e *requestError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.err
}

func setReady(ready bool) {
	isReady.Store(ready)
}

func parseBuildRequest(r *http.Request) BuildRequest {
	title := strings.TrimSpace(r.FormValue("title"))
	direction := r.FormValue("direction")
	layout := r.FormValue("layout")
	spread := r.FormValue("spread")

	authors := []string{}
	for _, name := range r.Form["authors"] {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			continue
		}
		authors = append(authors, trimmed)
	}
	for _, name := range r.Form["author"] {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			continue
		}
		authors = append(authors, trimmed)
	}

	language := strings.TrimSpace(r.FormValue("language"))
	coverStr := strings.TrimSpace(r.FormValue("cover"))

	req := BuildRequest{
		Title:     title,
		Authors:   authors,
		Direction: direction,
		Layout:    layout,
		Spread:    spread,
		Language:  language,
		Cover:     coverStr == "true" || coverStr == "1",
	}

	if req.Title == "" {
		req.Title = "Untitled"
	}
	if req.Direction == "" {
		req.Direction = "rtl"
	}
	if req.Layout == "" {
		req.Layout = "pre-paginated"
	}
	if req.Spread == "" {
		req.Spread = "right"
	}
	if req.Language == "" {
		langs := getSupportedLanguages()
		req.Language = langs[0]
	}

	return req
}

func writeJSONError(w http.ResponseWriter, status int, code string, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(ErrorResponse{
		Code:    code,
		Message: message,
	}); err != nil {
		slog.Error("failed to encode error response", "error", err)
	}
}

func newRequestTimeoutError(err error) error {
	return &requestError{
		status:  http.StatusGatewayTimeout,
		code:    "request_timeout",
		message: "Request timed out.",
		err:     err,
	}
}

func newBadRequestError(code string, message string, err error) error {
	return &requestError{
		status:  http.StatusBadRequest,
		code:    code,
		message: message,
		err:     err,
	}
}

func writeHandledRequestError(w http.ResponseWriter, err error) bool {
	if reqErr, ok := asRequestError(err); ok {
		writeJSONError(w, reqErr.status, reqErr.code, reqErr.message)
		return true
	}

	return false
}

func asRequestError(err error) (*requestError, bool) {
	var reqErr *requestError
	if !errors.As(err, &reqErr) {
		return nil, false
	}

	return reqErr, true
}

func closeMultipartFiles(files []multipart.File) {
	for _, file := range files {
		if file == nil {
			continue
		}
		_ = file.Close()
	}
}

func buildExtractContentDisposition(epubFilename string) string {
	base := strings.TrimSpace(epubFilename)
	base = strings.TrimSuffix(base, ".epub")
	base = strings.TrimSuffix(base, ".EPUB")
	if base == "" {
		base = "extracted"
	}
	return formatContentDisposition(base + ".zip")
}

func buildEPUBContentDisposition(title string) string {
	filename := strings.TrimSpace(title)
	if filename == "" {
		filename = "Untitled"
	}
	return formatContentDisposition(filename + ".epub")
}

func formatContentDisposition(filename string) string {
	fallback := toASCIIFilename(filename)
	encoded := url.PathEscape(filename)
	return fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`, fallback, encoded)
}

func toASCIIFilename(filename string) string {
	var b strings.Builder
	for _, r := range filename {
		if r >= 0x20 && r <= 0x7E && r != '"' && r != '\\' && r != ';' {
			b.WriteRune(r)
			continue
		}
		b.WriteByte('_')
	}

	result := strings.TrimSpace(b.String())
	if strings.Trim(result, "._-") == "" {
		return "download.epub"
	}

	return result
}

func extractSpineImageRefs(ctx context.Context, file multipart.File, header *multipart.FileHeader) ([]epub.SpineImageReference, error) {
	size, err := getFileSize(file)
	if err != nil {
		slog.Error("extract: failed to get file size", "error", err)
		return nil, &requestError{
			status:  http.StatusInternalServerError,
			code:    "read_epub_size_failed",
			message: "Failed to read EPUB file size.",
			err:     err,
		}
	}

	doc, err := epub.Decode(file, size)
	if err != nil {
		slog.Warn("extract: failed to decode epub", "filename", header.Filename, "error", err)
		return nil, newBadRequestError("invalid_epub", "Failed to decode EPUB.", err)
	}

	maxPages := getMaxPages()
	if maxPages > 0 && len(doc.Pages) > maxPages {
		slog.Warn("extract: too many pages", "filename", header.Filename, "pages", len(doc.Pages), "maxPages", maxPages)
		return nil, newBadRequestError("page_limit_exceeded", "Page limit exceeded.", fmt.Errorf("page count %d exceeded max pages %d", len(doc.Pages), maxPages))
	}

	refs, err := doc.ExtractReferencedImagesFromSpine()
	if err != nil {
		slog.Error("extract: failed to extract images", "filename", header.Filename, "error", err)
		return nil, &requestError{
			status:  http.StatusInternalServerError,
			code:    "extract_images_failed",
			message: "Failed to extract images.",
			err:     err,
		}
	}

	if err := validateExtractRefs(ctx, header.Filename, refs); err != nil {
		return nil, err
	}

	return refs, nil
}

func validateExtractRefs(ctx context.Context, filename string, refs []epub.SpineImageReference) error {
	maxAssetSize := getMaxAssetSizeBytes()
	maxImagePixels := getMaxImagePixels()
	maxImageLongEdge := getMaxImageLongEdge()
	var metricsCache sync.Map

	var eg errgroup.Group
	eg.SetLimit(getWorkerLimit())

	for _, ref := range refs {
		eg.Go(func() error {
			if err := ctx.Err(); err != nil {
				return newRequestTimeoutError(err)
			}

			assetSize := int64(ref.Asset.Size)
			if maxAssetSize > 0 && assetSize > maxAssetSize {
				slog.Warn("extract: asset size limit exceeded", "filename", filename, "href", ref.Href, "assetSize", assetSize, "maxAssetSize", maxAssetSize)
				return newBadRequestError("asset_size_limit_exceeded", "Asset size limit exceeded.", fmt.Errorf("asset %s exceeded size limit", ref.Href))
			}

			if maxImagePixels > 0 || maxImageLongEdge > 0 {
				var metrics imageMetrics

				if cached, ok := metricsCache.Load(ref.Href); ok {
					metrics = cached.(imageMetrics)
				} else {
					decodedMetrics, pixelErr := getAssetImageMetrics(ref.Asset)
					if pixelErr != nil {
						slog.Warn("extract: failed to decode image dimensions", "filename", filename, "href", ref.Href, "error", pixelErr)
						return newBadRequestError("invalid_image", "Failed to parse image dimensions.", pixelErr)
					}

					metrics = decodedMetrics
					metricsCache.Store(ref.Href, metrics)
				}

				if maxImagePixels > 0 && metrics.pixels > maxImagePixels {
					slog.Warn("extract: image pixels limit exceeded", "filename", filename, "href", ref.Href, "pixels", metrics.pixels, "maxPixels", maxImagePixels)
					return newBadRequestError("image_pixels_limit_exceeded", "Image pixel limit exceeded.", fmt.Errorf("asset %s exceeded image pixel limit", ref.Href))
				}

				if maxImageLongEdge > 0 && metrics.longEdge > maxImageLongEdge {
					slog.Warn("extract: image long edge limit exceeded", "filename", filename, "href", ref.Href, "longEdge", metrics.longEdge, "maxLongEdge", maxImageLongEdge)
					return newBadRequestError("image_long_edge_limit_exceeded", "Image long edge limit exceeded.", fmt.Errorf("asset %s exceeded image long edge limit", ref.Href))
				}
			}

			if err := ctx.Err(); err != nil {
				return newRequestTimeoutError(err)
			}

			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		if _, ok := asRequestError(err); ok {
			return err
		}
		slog.Error("extract: checks failed", "filename", filename, "error", err)
		return &requestError{
			status:  http.StatusInternalServerError,
			code:    "extract_images_failed",
			message: "Failed to extract images.",
			err:     err,
		}
	}

	return nil
}

func writeExtractArchive(ctx context.Context, w io.Writer, filename string, refs []epub.SpineImageReference) error {
	zw := zip.NewWriter(w)

	for _, ref := range refs {
		if err := ctx.Err(); err != nil {
			slog.Warn("extract: request canceled during zip stream", "filename", filename, "error", err)
			return err
		}

		zf, err := zw.Create(ref.Href)
		if err != nil {
			slog.Error("extract: failed to create zip entry", "filename", filename, "href", ref.Href, "error", err)
			return err
		}

		rc, err := ref.Asset.Open()
		if err != nil {
			slog.Error("extract: failed to open asset", "filename", filename, "href", ref.Href, "error", err)
			return err
		}

		if _, err := io.Copy(zf, rc); err != nil {
			_ = rc.Close()
			if ctxErr := ctx.Err(); ctxErr != nil {
				slog.Warn("extract: request canceled while streaming zip", "filename", filename, "href", ref.Href, "error", ctxErr)
				return ctxErr
			}
			slog.Error("extract: failed to write zip entry", "filename", filename, "href", ref.Href, "error", err)
			return err
		}

		if err := rc.Close(); err != nil {
			slog.Error("extract: failed to close asset", "filename", filename, "href", ref.Href, "error", err)
			return err
		}
	}

	if err := zw.Close(); err != nil {
		slog.Error("extract: failed to finalize zip", "filename", filename, "error", err)
		return err
	}

	return nil
}

func buildDocument(ctx context.Context, req BuildRequest, files []*multipart.FileHeader) (*epub.Document, error) {
	if len(files) == 0 {
		slog.Warn("build: no images provided")
		return nil, newBadRequestError("no_images_provided", "No images provided.", fmt.Errorf("no images provided"))
	}

	layoutType, spread, err := normalizeAndValidateBuildOptions(req.Layout, req.Spread)
	if err != nil {
		return nil, err
	}

	maxPages := getMaxPages()
	if maxPages > 0 && len(files) > maxPages {
		slog.Warn("build: too many pages", "pages", len(files), "maxPages", maxPages)
		return nil, newBadRequestError("page_limit_exceeded", "Page limit exceeded.", fmt.Errorf("page count %d exceeded max pages %d", len(files), maxPages))
	}

	creators := make([]epub.Creator, 0, len(req.Authors))
	for _, name := range req.Authors {
		creators = append(creators, epub.Creator{Name: name})
	}

	doc := &epub.Document{
		Metadata:  epub.Metadata{Title: req.Title, Language: req.Language, Creators: creators},
		Direction: req.Direction,
		Layout:    layoutType,
	}

	if err := validateBuildFiles(ctx, files); err != nil {
		return nil, err
	}

	if err := addBuildPagesInOrder(ctx, doc, files, spread, req.Cover); err != nil {
		return nil, err
	}

	return doc, nil
}

func normalizeAndValidateBuildOptions(layout string, spread string) (epub.LayoutType, string, error) {
	layoutNormalized := strings.ToLower(strings.TrimSpace(layout))
	spreadNormalized := strings.ToLower(strings.TrimSpace(spread))
	if layoutNormalized == "" {
		layoutNormalized = "pre-paginated"
	}
	if spreadNormalized == "" {
		spreadNormalized = "right"
	}

	var layoutType epub.LayoutType
	switch layoutNormalized {
	case "pre-paginated":
		layoutType = epub.LayoutPrePaginated
	case "reflowable":
		layoutType = epub.LayoutReflowable
	default:
		return epub.LayoutUnknown, "", newBadRequestError(
			"invalid_layout",
			"Invalid layout.",
			fmt.Errorf("unsupported layout: %q", layout),
		)
	}

	switch spreadNormalized {
	case "right", "left", "center":
		return layoutType, spreadNormalized, nil
	default:
		return epub.LayoutUnknown, "", newBadRequestError(
			"invalid_spread",
			"Invalid spread.",
			fmt.Errorf("unsupported spread: %q", spread),
		)
	}
}

func validateBuildFiles(ctx context.Context, files []*multipart.FileHeader) error {
	maxAssetSize := getMaxAssetSizeBytes()
	maxImagePixels := getMaxImagePixels()
	maxImageLongEdge := getMaxImageLongEdge()

	var eg errgroup.Group
	eg.SetLimit(getWorkerLimit())

	for _, fileHeader := range files {
		eg.Go(func() error {
			if err := ctx.Err(); err != nil {
				return newRequestTimeoutError(err)
			}

			if maxAssetSize > 0 && fileHeader.Size > maxAssetSize {
				slog.Warn("build: asset size limit exceeded", "filename", fileHeader.Filename, "assetSize", fileHeader.Size, "maxAssetSize", maxAssetSize)
				return newBadRequestError("asset_size_limit_exceeded", "Asset size limit exceeded.", fmt.Errorf("asset %s exceeded size limit", fileHeader.Filename))
			}

			f, err := fileHeader.Open()
			if err != nil {
				return newBadRequestError("open_image_failed", "Failed to open image.", err)
			}
			defer func() { _ = f.Close() }()

			if maxImagePixels > 0 || maxImageLongEdge > 0 {
				metrics, pixelErr := getMultipartFileImageMetrics(f)
				if pixelErr != nil {
					slog.Warn("build: failed to decode image dimensions", "filename", fileHeader.Filename, "error", pixelErr)
					return newBadRequestError("invalid_image", "Failed to parse image dimensions.", pixelErr)
				}

				if maxImagePixels > 0 && metrics.pixels > maxImagePixels {
					slog.Warn("build: image pixels limit exceeded", "filename", fileHeader.Filename, "pixels", metrics.pixels, "maxPixels", maxImagePixels)
					return newBadRequestError("image_pixels_limit_exceeded", "Image pixel limit exceeded.", fmt.Errorf("asset %s exceeded image pixel limit", fileHeader.Filename))
				}

				if maxImageLongEdge > 0 && metrics.longEdge > maxImageLongEdge {
					slog.Warn("build: image long edge limit exceeded", "filename", fileHeader.Filename, "longEdge", metrics.longEdge, "maxLongEdge", maxImageLongEdge)
					return newBadRequestError("image_long_edge_limit_exceeded", "Image long edge limit exceeded.", fmt.Errorf("asset %s exceeded image long edge limit", fileHeader.Filename))
				}
			}

			if err := ctx.Err(); err != nil {
				return newRequestTimeoutError(err)
			}

			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		if _, ok := asRequestError(err); ok {
			return err
		}
		slog.Error("build: checks failed", "error", err)
		return &requestError{
			status:  http.StatusInternalServerError,
			code:    "invalid_image",
			message: "Failed to add image.",
			err:     err,
		}
	}

	return nil
}

func isLandscapeFile(f multipart.File) bool {
	currentPos, err := f.Seek(0, io.SeekCurrent)
	if err != nil {
		return false
	}

	config, _, decodeErr := image.DecodeConfig(f)
	if _, seekErr := f.Seek(currentPos, io.SeekStart); seekErr != nil {
		return false
	}
	if decodeErr != nil {
		return false
	}

	return config.Width > config.Height
}

func splitLandscapeImage(f multipart.File) (leftHalf, rightHalf []byte, err error) {
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return nil, nil, err
	}

	img, format, err := image.Decode(f)
	if err != nil {
		return nil, nil, err
	}

	bounds := img.Bounds()
	midX := (bounds.Min.X + bounds.Max.X) / 2

	type subImager interface {
		SubImage(r image.Rectangle) image.Image
	}

	si, ok := img.(subImager)
	if !ok {
		return nil, nil, fmt.Errorf("image type %T does not support SubImage", img)
	}

	leftImg := si.SubImage(image.Rect(bounds.Min.X, bounds.Min.Y, midX, bounds.Max.Y))
	rightImg := si.SubImage(image.Rect(midX, bounds.Min.Y, bounds.Max.X, bounds.Max.Y))

	leftHalf, err = encodeImage(leftImg, format)
	if err != nil {
		return nil, nil, err
	}

	rightHalf, err = encodeImage(rightImg, format)
	if err != nil {
		return nil, nil, err
	}

	return leftHalf, rightHalf, nil
}

func encodeImage(img image.Image, format string) ([]byte, error) {
	var buf bytes.Buffer
	switch format {
	case "jpeg":
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 95}); err != nil {
			return nil, err
		}
	default:
		if err := png.Encode(&buf, img); err != nil {
			return nil, err
		}
	}
	return buf.Bytes(), nil
}

func addBuildPagesInOrder(ctx context.Context, doc *epub.Document, files []*multipart.FileHeader, spread string, cover bool) error {
	openFiles := make([]multipart.File, 0, len(files))
	defer closeMultipartFiles(openFiles)

	logicalPageIndex := 0

	for i, fileHeader := range files {
		if err := ctx.Err(); err != nil {
			return newRequestTimeoutError(err)
		}

		f, err := fileHeader.Open()
		if err != nil {
			return newBadRequestError("open_image_failed", "Failed to open image.", err)
		}

		openFiles = append(openFiles, f)

		if cover && i == 0 {
			if _, _, err := doc.SetCover(f, fileHeader.Size); err != nil {
				slog.Warn("build: failed to set cover", "filename", fileHeader.Filename, "error", err)
				return newBadRequestError("invalid_image", "Failed to add image.", err)
			}
			continue
		}

		if isLandscapeFile(f) {
			leftBytes, rightBytes, splitErr := splitLandscapeImage(f)
			if splitErr != nil {
				slog.Warn("build: failed to split landscape image", "filename", fileHeader.Filename, "error", splitErr)
				return newBadRequestError("invalid_image", "Failed to add image.", splitErr)
			}

			var firstBytes, secondBytes []byte
			var firstSpread, secondSpread string
			if doc.Direction == "ltr" {
				firstBytes, secondBytes = leftBytes, rightBytes
				firstSpread, secondSpread = "left", "right"
			} else {
				firstBytes, secondBytes = rightBytes, leftBytes
				firstSpread, secondSpread = "right", "left"
			}

			firstReader := bytes.NewReader(firstBytes)
			if _, _, err := doc.AddPageWithAsset(firstReader, int64(len(firstBytes)), firstSpread); err != nil {
				slog.Warn("build: failed to add split image", "filename", fileHeader.Filename, "error", err)
				return newBadRequestError("invalid_image", "Failed to add image.", err)
			}

			secondReader := bytes.NewReader(secondBytes)
			if _, _, err := doc.AddPageWithAsset(secondReader, int64(len(secondBytes)), secondSpread); err != nil {
				slog.Warn("build: failed to add split image", "filename", fileHeader.Filename, "error", err)
				return newBadRequestError("invalid_image", "Failed to add image.", err)
			}

			logicalPageIndex += 2
			continue
		}

		pageSpread := calculatePageSpread(logicalPageIndex, spread)
		logicalPageIndex++

		if _, _, err := doc.AddPageWithAsset(f, fileHeader.Size, pageSpread); err != nil {
			slog.Warn("build: failed to add image", "filename", fileHeader.Filename, "error", err)
			return newBadRequestError("invalid_image", "Failed to add image.", err)
		}
	}

	return nil
}

func calculatePageSpread(index int, spread string) string {
	if index == 0 {
		return "center"
	}

	switch spread {
	case "right":
		if index%2 == 1 {
			return "right"
		}
		return "left"
	case "left":
		if index%2 == 1 {
			return "left"
		}
		return "right"
	default:
		return "center"
	}
}

func getFileSize(file multipart.File) (int64, error) {
	currentPos, err := file.Seek(0, io.SeekCurrent)
	if err != nil {
		return 0, err
	}

	endPos, err := file.Seek(0, io.SeekEnd)
	if err != nil {
		return 0, err
	}

	if _, err := file.Seek(currentPos, io.SeekStart); err != nil {
		return 0, err
	}

	return endPos, nil
}

func getMultipartFileImageMetrics(file multipart.File) (imageMetrics, error) {
	currentPos, err := file.Seek(0, io.SeekCurrent)
	if err != nil {
		return imageMetrics{}, err
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return imageMetrics{}, err
	}

	config, _, err := image.DecodeConfig(file)
	if _, seekErr := file.Seek(currentPos, io.SeekStart); seekErr != nil {
		return imageMetrics{}, seekErr
	}
	if err != nil {
		return imageMetrics{}, err
	}

	return toImageMetrics(config), nil
}

func getAssetImageMetrics(asset *epub.Asset) (imageMetrics, error) {
	if asset == nil {
		return imageMetrics{}, fmt.Errorf("asset is nil")
	}

	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(asset.MimeType)), "image/") {
		return imageMetrics{}, nil
	}

	rc, err := asset.Open()
	if err != nil {
		return imageMetrics{}, err
	}
	defer func() { _ = rc.Close() }()

	config, _, err := image.DecodeConfig(rc)
	if err != nil {
		return imageMetrics{}, err
	}

	return toImageMetrics(config), nil
}

func toImageMetrics(config image.Config) imageMetrics {
	longEdge := int64(config.Width)
	if config.Height > config.Width {
		longEdge = int64(config.Height)
	}

	return imageMetrics{
		pixels:   int64(config.Width) * int64(config.Height),
		longEdge: longEdge,
	}
}
