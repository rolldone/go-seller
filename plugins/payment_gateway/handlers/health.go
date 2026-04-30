package handlers

import "github.com/gin-gonic/gin"

// HealthHandler returns a simple health response for the plugin.
func HealthHandler(c *gin.Context) {
	c.JSON(200, gin.H{"status": "ok", "plugin": "payment_gateway"})
}
