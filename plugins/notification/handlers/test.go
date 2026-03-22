package handlers

import (
	"fmt"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"go_framework/plugins/notification/services"

	"github.com/gin-gonic/gin"
)

type testNotificationRequest struct {
	To     string            `json:"to"`
	Locale string            `json:"locale"`
	Vars   map[string]string `json:"vars"`
}

type testNotificationResponse struct {
	TemplateID string    `json:"template_id"`
	SentTo     string    `json:"sent_to"`
	Locale     string    `json:"locale"`
	Subject    string    `json:"subject"`
	Body       string    `json:"body"`
	HTMLBody   string    `json:"html_body"`
	Timestamp  time.Time `json:"timestamp"`
}

func TestNotificationHandler(svc *services.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		templateID := strings.TrimSpace(c.Param("id"))
		if templateID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "template id is required"})
			return
		}

		var req testNotificationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		to := strings.TrimSpace(req.To)
		if to == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "recipient email is required"})
			return
		}
		if _, err := mail.ParseAddress(to); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid recipient email"})
			return
		}

		locale := services.NormalizeLocale(req.Locale)
		ctx := c.Request.Context()
		config, err := svc.LoadTemplateConfig(ctx, templateID, locale)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to load template: %v", err)})
			return
		}

		payload := svc.BuildTestPayload(req.Vars)
		subject, err := svc.RenderTemplate(config.Subject, payload)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to render subject: %v", err)})
			return
		}
		body, err := svc.RenderTemplate(config.Body, payload)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to render body: %v", err)})
			return
		}

		if err := svc.SendInlineEmail(to, subject, body); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to send email: %v", err)})
			return
		}

		htmlBody := svc.FormatHTML(body)
		log.Printf("[notification] test email sent template=%s locale=%s to=%s", templateID, locale, to)

		c.JSON(http.StatusOK, testNotificationResponse{
			TemplateID: templateID,
			SentTo:     to,
			Locale:     locale,
			Subject:    subject,
			Body:       body,
			HTMLBody:   htmlBody,
			Timestamp:  time.Now(),
		})
	}
}
