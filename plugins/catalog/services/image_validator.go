package services

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
)

// ImageValidationResult contains the result of validating an image file.
type ImageValidationResult struct {
	Valid  bool   `json:"valid"`
	Width  int    `json:"width,omitempty"`
	Height int    `json:"height,omitempty"`
	Format string `json:"format,omitempty"`
	Size   int64  `json:"size,omitempty"`
	Error  string `json:"error,omitempty"`
}

// ValidateImage reads a file from storage (key) and validates its size and image dimensions/format.
// - ctx: request context
// - key: storage key (ingest path)
// - maxSize: maximum allowed size in bytes (0 = no limit)
// - allowedFormats: list of allowed formats (e.g. ["jpeg","png","webp"]) empty = allow all
func (s *CatalogService) ValidateImage(ctx context.Context, key string, maxSize int64, allowedFormats []string) (ImageValidationResult, error) {
	var res ImageValidationResult

	// Stat to get size if available
	if fi, err := s.Store.Stat(ctx, key); err == nil && fi != nil {
		res.Size = fi.Size
		if maxSize > 0 && fi.Size > maxSize {
			res.Valid = false
			res.Error = "file size exceeds limit"
			return res, nil
		}
	}

	rc, err := s.Store.Get(ctx, key)
	if err != nil {
		return res, fmt.Errorf("failed to open file from storage: %w", err)
	}
	defer rc.Close()

	// Read up to maxSize+1 bytes to avoid OOM; if maxSize==0 read all
	var reader io.Reader = rc
	if maxSize > 0 {
		reader = io.LimitReader(rc, maxSize+1)
	}
	buf, err := io.ReadAll(reader)
	if err != nil {
		return res, fmt.Errorf("failed to read file: %w", err)
	}

	// If Stat wasn't available, set size from read bytes
	if res.Size == 0 {
		res.Size = int64(len(buf))
		if maxSize > 0 && res.Size > maxSize {
			res.Valid = false
			res.Error = "file size exceeds limit"
			return res, nil
		}
	}

	// Detect content type from header
	ct := http.DetectContentType(buf)

	// Try decode config for common formats
	cfg, format, err := image.DecodeConfig(bytes.NewReader(buf))
	if err == nil {
		res.Width = cfg.Width
		res.Height = cfg.Height
		res.Format = format
		// normalize format names (image.DecodeConfig returns "jpeg", "png", "gif")
	} else {
		// If decode failed, detect WebP by header and accept (dimensions unknown)
		if len(buf) >= 12 && string(buf[8:12]) == "WEBP" {
			res.Format = "webp"
			res.Width = 0
			res.Height = 0
		} else {
			// Unknown/unsupported image format
			res.Valid = false
			res.Error = fmt.Sprintf("unsupported image format: %s", ct)
			return res, nil
		}
	}

	// If allowedFormats specified, check
	if len(allowedFormats) > 0 {
		ok := false
		for _, a := range allowedFormats {
			if a == res.Format {
				ok = true
				break
			}
		}
		if !ok {
			res.Valid = false
			res.Error = "format not allowed"
			return res, nil
		}
	}

	res.Valid = true
	return res, nil
}
