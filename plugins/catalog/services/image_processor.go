package services

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"math"

	"golang.org/x/image/draw"
)

// ProcessedImage holds result metadata for a processed derivative.
type ProcessedImage struct {
	Key    string
	Width  int
	Height int
	Size   int64
}

// ResizeAndUpload reads source image from storeKey, resizes to fit within maxWidth x maxHeight
// (preserving aspect ratio), encodes as JPEG or PNG based on original, uploads to destKey, and returns metadata.
func (s *CatalogService) ResizeAndUpload(ctx context.Context, storeKey, destKey string, maxWidth, maxHeight int) (*ProcessedImage, error) {
	rc, err := s.Store.Get(ctx, storeKey)
	if err != nil {
		return nil, fmt.Errorf("failed to open source: %w", err)
	}
	defer rc.Close()

	src, format, err := image.Decode(rc)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	// Calculate target size preserving aspect ratio
	srcBounds := src.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()
	if srcW == 0 || srcH == 0 {
		return nil, fmt.Errorf("invalid source image dimensions")
	}

	scale := math.Min(float64(maxWidth)/float64(srcW), float64(maxHeight)/float64(srcH))
	if scale > 1 {
		scale = 1
	}
	tgtW := int(math.Max(1, math.Floor(float64(srcW)*scale)))
	tgtH := int(math.Max(1, math.Floor(float64(srcH)*scale)))

	dst := image.NewRGBA(image.Rect(0, 0, tgtW, tgtH))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, srcBounds, draw.Over, nil)

	// Encode
	buf := &bytes.Buffer{}
	switch format {
	case "png":
		if err := png.Encode(buf, dst); err != nil {
			return nil, fmt.Errorf("png encode: %w", err)
		}
	default:
		if err := jpeg.Encode(buf, dst, &jpeg.Options{Quality: 85}); err != nil {
			return nil, fmt.Errorf("jpeg encode: %w", err)
		}
	}

	if err := s.Store.Put(ctx, destKey, bytes.NewReader(buf.Bytes())); err != nil {
		return nil, fmt.Errorf("failed to upload processed image: %w", err)
	}

	return &ProcessedImage{Key: destKey, Width: tgtW, Height: tgtH, Size: int64(buf.Len())}, nil
}
