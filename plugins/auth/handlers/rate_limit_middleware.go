package handlers

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateState struct {
	count   int
	resetAt time.Time
}

// NewIPRateLimiter limits requests per IP in a fixed time window.
func NewIPRateLimiter(limit int, window time.Duration) gin.HandlerFunc {
	if limit <= 0 {
		limit = 5
	}
	if window <= 0 {
		window = time.Minute
	}

	var mu sync.Mutex
	store := map[string]rateState{}

	return func(c *gin.Context) {
		now := time.Now()
		key := fmt.Sprintf("%s|%s", c.ClientIP(), c.FullPath())

		mu.Lock()
		st := store[key]
		if st.resetAt.IsZero() || now.After(st.resetAt) {
			st = rateState{count: 0, resetAt: now.Add(window)}
		}
		st.count++
		store[key] = st
		remaining := limit - st.count
		retryAfter := int(time.Until(st.resetAt).Seconds())
		mu.Unlock()

		if remaining < 0 {
			if retryAfter < 1 {
				retryAfter = 1
			}
			c.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}

		c.Next()
	}
}
