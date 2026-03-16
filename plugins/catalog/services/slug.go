package services

import (
	"regexp"
	"strings"
)

var slugInvalidChars = regexp.MustCompile(`[^a-z0-9]+`)

func makeSlug(input string) string {
	s := strings.ToLower(strings.TrimSpace(input))
	s = slugInvalidChars.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		return "product"
	}
	return s
}
