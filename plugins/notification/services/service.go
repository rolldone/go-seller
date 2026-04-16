package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"os"
	"strconv"
	"strings"
	txttpl "text/template"
	"time"

	"go_framework/internal/uuid"
	authmodels "go_framework/plugins/auth/models"
	"go_framework/plugins/notification/mail"
	ordermodels "go_framework/plugins/order/models"
	settingmodels "go_framework/plugins/setting/models"

	"gorm.io/gorm"
)

// Service is the notification service used by the notification plugin.
type Service struct {
	DB *gorm.DB
}

func New(db *gorm.DB) *Service { return &Service{DB: db} }

type SeedEntry struct {
	Key         string          `json:"key"`
	Scope       string          `json:"scope"`
	Value       json.RawMessage `json:"value"`
	Description *string         `json:"description"`
}

type TemplateConfig struct {
	Name        string `json:"name"`
	Audience    string `json:"audience"`
	Enabled     bool   `json:"enabled"`
	Recipients  string `json:"recipients"`
	Subject     string `json:"subject"`
	Body        string `json:"body"`
	Description string `json:"description,omitempty"`
}

type inlineMail struct {
	subject  string
	htmlBody string
	textBody string
	fromMail string
	fromName string
}

func (m *inlineMail) Subject() string              { return m.subject }
func (m *inlineMail) TemplateBase() string         { return "" }
func (m *inlineMail) Data() map[string]interface{} { return map[string]interface{}{} }
func (m *inlineMail) From() (string, string)       { return m.fromMail, m.fromName }
func (m *inlineMail) HTMLBody() string             { return m.htmlBody }
func (m *inlineMail) TextBody() string             { return m.textBody }

var defaultTemplates = map[string]TemplateConfig{
	"new_order_admin": {
		Name:       "New Order",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, owner@goseller.local",
		Subject:    "[Order Baru] {{.order_number}} - {{.business_name}}",
		Body:       "Halo Admin, order baru {{.order_number}} dengan total {{.currency}} {{.grand_total}} baru saja dibuat.",
	},
	"cancelled_order_admin": {
		Name:       "Cancelled Order",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local",
		Subject:    "[Order Dibatalkan] {{.order_number}}",
		Body:       "Order {{.order_number}} dibatalkan. Status order saat ini: {{.order_status}}.",
	},
	"failed_order_admin": {
		Name:       "Failed Order",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "finance@goseller.local",
		Subject:    "[Payment Gagal] {{.order_number}}",
		Body:       "Payment untuk order {{.order_number}} gagal atau ditolak. Status payment: {{.payment_status}}.",
	},
	"processing_order_customer": {
		Name:       "Processing Order",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Order kamu sedang diproses - {{.order_number}}",
		Body:       "Hi {{.customer_name}}, order {{.order_number}} sudah kami terima dan pembayaran sudah terverifikasi.",
	},
	"completed_order_customer": {
		Name:       "Completed Order",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Order selesai - {{.order_number}}",
		Body:       "Hi {{.customer_name}}, order {{.order_number}} sudah selesai. Terima kasih sudah belanja.",
	},
	"customer_forgot_password": {
		Name:       "Customer Forgot Password",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Reset password akun GoSeller",
		Body:       "Halo {{.customer_name}}, kami menerima permintaan reset password. Klik tautan berikut untuk melanjutkan: {{.reset_url}}. Tautan ini berlaku 15 menit.",
	},
	"proof_uploaded_admin": {
		Name:       "Proof Uploaded",
		Audience:   "admin",
		Enabled:    false,
		Recipients: "admin@goseller.local",
		Subject:    "[Bukti Transfer Baru] {{.order_number}}",
		Body:       "Bukti transfer baru sudah diupload untuk order {{.order_number}}. Silakan cek panel admin.",
	},
}

var defaultTemplatesEN = map[string]TemplateConfig{
	"new_order_admin": {
		Name:       "New Order",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, owner@goseller.local",
		Subject:    "[New Order] {{.order_number}} - {{.business_name}}",
		Body:       "Hello Admin, new order {{.order_number}} with total {{.currency}} {{.grand_total}} has just been created.",
	},
	"cancelled_order_admin": {
		Name:       "Cancelled Order",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local",
		Subject:    "[Order Cancelled] {{.order_number}}",
		Body:       "Order {{.order_number}} has been cancelled. Current order status: {{.order_status}}.",
	},
	"failed_order_admin": {
		Name:       "Failed Order",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "finance@goseller.local",
		Subject:    "[Payment Failed] {{.order_number}}",
		Body:       "Payment for order {{.order_number}} failed or was rejected. Payment status: {{.payment_status}}.",
	},
	"processing_order_customer": {
		Name:       "Processing Order",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Your order is being processed - {{.order_number}}",
		Body:       "Hi {{.customer_name}}, your order {{.order_number}} has been received and your payment has been verified.",
	},
	"completed_order_customer": {
		Name:       "Completed Order",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Order completed - {{.order_number}}",
		Body:       "Hi {{.customer_name}}, your order {{.order_number}} is completed. Thank you for shopping with us.",
	},
	"customer_forgot_password": {
		Name:       "Customer Forgot Password",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Reset GoSeller account password",
		Body:       "Hi {{.customer_name}}, we received a password reset request for your account. Click this link to continue: {{.reset_url}}. This link is valid for 15 minutes.",
	},
	"proof_uploaded_admin": {
		Name:       "Proof Uploaded",
		Audience:   "admin",
		Enabled:    false,
		Recipients: "admin@goseller.local",
		Subject:    "[New Transfer Proof] {{.order_number}}",
		Body:       "A new transfer proof has been uploaded for order {{.order_number}}. Please check the admin panel.",
	},
}

func NormalizeLocale(value string) string {
	locale := strings.ToLower(strings.TrimSpace(value))
	switch locale {
	case "id", "en":
		return locale
	default:
		return "id"
	}
}

func (s *Service) defaultTemplateFor(eventKey string, locale string) TemplateConfig {
	locale = NormalizeLocale(locale)
	if locale == "en" {
		if cfg, ok := defaultTemplatesEN[eventKey]; ok {
			return cfg
		}
	}
	if cfg, ok := defaultTemplates[eventKey]; ok {
		return cfg
	}
	return TemplateConfig{}
}

func (s *Service) SendOrderEvent(ctx context.Context, db *gorm.DB, eventKey string, orderID string) error {
	orderID = strings.TrimSpace(orderID)
	if db == nil || orderID == "" {
		return nil
	}

	var order ordermodels.Order
	if err := db.WithContext(ctx).
		Preload("Customer").
		Preload("Payments").
		Where("id = ?", orderID).
		First(&order).Error; err != nil {
		return err
	}

	return s.dispatch(ctx, db, eventKey, &order)
}

func (s *Service) SendOrderEventAsync(ctx context.Context, db *gorm.DB, eventKey string, orderID string) {
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = s.SendOrderEvent(bgCtx, db, eventKey, orderID)
	}()
}

// SendTemplateEvent dispatches a notification template using an arbitrary payload.
func (s *Service) SendTemplateEvent(ctx context.Context, db *gorm.DB, eventKey string, payload map[string]interface{}) error {
	if db == nil {
		return nil
	}
	return s.dispatchTemplate(ctx, db, eventKey, payload)
}

// SendTemplateEventAsync dispatches a notification template asynchronously.
func (s *Service) SendTemplateEventAsync(ctx context.Context, db *gorm.DB, eventKey string, payload map[string]interface{}) {
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = s.SendTemplateEvent(bgCtx, db, eventKey, payload)
	}()
}

func (s *Service) SendTestEmail(toEmail string, subject string, body string) error {
	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" {
		return errors.New("recipient email is required")
	}
	subject = strings.TrimSpace(subject)
	if subject == "" {
		subject = "Test Notification"
	}
	body = strings.TrimSpace(body)
	if body == "" {
		body = "Test email from Go Seller notification plugin sent at " + time.Now().Format(time.RFC3339)
	}
	htmlBody := s.wrapHTML(body)
	message := &inlineMail{subject: subject, htmlBody: htmlBody, textBody: body}
	return mail.NewMailer().Send(toEmail, message)
}

// LoadTemplateConfig returns the notification template config for a given event key and locale.
func (s *Service) LoadTemplateConfig(ctx context.Context, eventKey string, locale string) (TemplateConfig, error) {
	if s == nil || s.DB == nil {
		return TemplateConfig{}, errors.New("notification service is not initialized")
	}
	norm := NormalizeLocale(locale)
	return s.loadConfig(ctx, s.DB, eventKey, norm, s.getDefaultLocale(ctx, s.DB))
}

// BuildTestPayload returns placeholder data merged with overrides so tests can render templates.
func (s *Service) BuildTestPayload(overrides map[string]string) map[string]interface{} {
	if overrides == nil {
		overrides = map[string]string{}
	}
	payload := map[string]interface{}{
		"order_id":        "test-order",
		"order_number":    "TEST-1001",
		"order_status":    "pending",
		"payment_status":  "paid",
		"grand_total":     "123.45",
		"currency":        "IDR",
		"customer_name":   "Test Customer",
		"customer_email":  "test@example.com",
		"customer_locale": "id",
		"business_name":   "Go Seller",
		"order_link":      "/admin/orders",
		"reset_token":     "TEST-RESET-TOKEN",
		"reset_url":       "https://example.com/customer/auth/reset-password?token=TEST-RESET-TOKEN",
		"app_name":        "Go Seller",
	}
	for key, value := range overrides {
		if strings.TrimSpace(key) == "" {
			continue
		}
		payload[key] = value
	}
	return payload
}

func (s *Service) wrapHTML(body string) string {
	trimmed := strings.TrimSpace(body)
	escaped := html.EscapeString(trimmed)
	formatted := strings.ReplaceAll(escaped, "\n", "<br/>")
	return fmt.Sprintf("<html><body><div style=\"font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;\">%s</div></body></html>", formatted)
}

// RenderTemplate exposes the internal template renderer for other packages.
func (s *Service) RenderTemplate(input string, data map[string]interface{}) (string, error) {
	return s.renderTemplate(input, data)
}

// FormatHTML wraps a plain-text body with the HTML wrapper used by the mailer.
func (s *Service) FormatHTML(body string) string {
	return s.wrapHTML(body)
}

// SendInlineEmail sends the provided subject/body to the given recipient using the internal mailer.
func (s *Service) SendInlineEmail(toEmail string, subject string, body string) error {
	if strings.TrimSpace(toEmail) == "" {
		return errors.New("recipient email is required")
	}
	message := &inlineMail{subject: subject, htmlBody: s.wrapHTML(body), textBody: body}
	return mail.NewMailer().Send(toEmail, message)
}

func (s *Service) SeedDefaults(path string) error {
	if s == nil || s.DB == nil {
		return errors.New("notification: service database is not configured")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var entries []SeedEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return err
	}
	now := time.Now()
	for _, entry := range entries {
		var existing settingmodels.Setting
		err := s.DB.Where("scope = ? AND key = ?", entry.Scope, entry.Key).First(&existing).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		item := settingmodels.Setting{
			ID:          uuid.NewString(),
			Scope:       entry.Scope,
			Key:         entry.Key,
			Value:       []byte(entry.Value),
			Description: entry.Description,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if err := s.DB.Create(&item).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) dispatch(ctx context.Context, db *gorm.DB, eventKey string, order *ordermodels.Order) error {
	payload := s.buildPayload(ctx, db, order)
	return s.dispatchTemplate(ctx, db, eventKey, payload)
}

func (s *Service) dispatchTemplate(ctx context.Context, db *gorm.DB, eventKey string, payload map[string]interface{}) error {
	if payload == nil {
		payload = map[string]interface{}{}
	}
	customerLocale, _ := payload["customer_locale"].(string)
	defaultLocale := s.getDefaultLocale(ctx, db)
	config := s.defaultTemplateFor(eventKey, customerLocale)
	if stored, err := s.loadConfig(ctx, db, eventKey, customerLocale, defaultLocale); err == nil {
		config = stored
	}
	if !config.Enabled {
		return nil
	}

	subject, err := s.renderTemplate(config.Subject, payload)
	if err != nil {
		return err
	}
	body, err := s.renderTemplate(config.Body, payload)
	if err != nil {
		return err
	}
	recipientsRaw, err := s.renderTemplate(config.Recipients, payload)
	if err != nil {
		return err
	}
	recipients := s.splitRecipients(recipientsRaw)
	if len(recipients) == 0 {
		return nil
	}

	htmlBody := "<html><body><div style=\"font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;\">" + strings.ReplaceAll(html.EscapeString(body), "\n", "<br/>") + "</div></body></html>"
	mailer := mail.NewMailer()
	message := &inlineMail{subject: subject, htmlBody: htmlBody, textBody: body}
	for _, recipient := range recipients {
		mailer.Queue(recipient, message)
	}
	return nil
}

func (s *Service) loadConfig(ctx context.Context, db *gorm.DB, eventKey string, customerLocale string, defaultLocale string) (TemplateConfig, error) {
	customerLocale = NormalizeLocale(customerLocale)
	defaultLocale = NormalizeLocale(defaultLocale)
	keys := []string{
		"notifications." + strings.TrimSpace(eventKey) + "." + customerLocale,
	}
	if defaultLocale != customerLocale {
		keys = append(keys, "notifications."+strings.TrimSpace(eventKey)+"."+defaultLocale)
	}
	keys = append(keys, "notifications."+strings.TrimSpace(eventKey))

	var lastErr error
	for _, key := range keys {
		cfg, err := s.loadConfigByKey(ctx, db, key, eventKey, customerLocale)
		if err == nil {
			return cfg, nil
		}
		lastErr = err
	}
	if lastErr == nil {
		lastErr = errors.New("notification config not found")
	}
	return TemplateConfig{}, lastErr
}

func (s *Service) loadConfigByKey(ctx context.Context, db *gorm.DB, key string, eventKey string, locale string) (TemplateConfig, error) {
	var item settingmodels.Setting
	if err := db.WithContext(ctx).Where("scope = ? AND key = ?", "global", key).First(&item).Error; err != nil {
		return TemplateConfig{}, err
	}
	var cfg TemplateConfig
	if err := json.Unmarshal(item.Value, &cfg); err != nil {
		return TemplateConfig{}, err
	}
	fallback := s.defaultTemplateFor(eventKey, locale)
	if cfg.Subject == "" || cfg.Body == "" || cfg.Recipients == "" {
		if cfg.Subject == "" {
			cfg.Subject = fallback.Subject
		}
		if cfg.Body == "" {
			cfg.Body = fallback.Body
		}
		if cfg.Recipients == "" {
			cfg.Recipients = fallback.Recipients
		}
	}
	if cfg.Name == "" {
		cfg.Name = fallback.Name
	}
	if cfg.Audience == "" {
		cfg.Audience = fallback.Audience
	}
	return cfg, nil
}

func (s *Service) getDefaultLocale(ctx context.Context, db *gorm.DB) string {
	var item settingmodels.Setting
	if err := db.WithContext(ctx).Where("scope = ? AND key = ?", "global", "i18n.default_locale").First(&item).Error; err != nil {
		return "id"
	}
	var locale string
	if err := json.Unmarshal(item.Value, &locale); err != nil {
		return "id"
	}
	return NormalizeLocale(locale)
}

func (s *Service) buildPayload(ctx context.Context, db *gorm.DB, order *ordermodels.Order) map[string]interface{} {
	var customerName string
	var customerEmail string
	customerLocale := "id"
	if order.Customer != nil {
		customerName = strings.TrimSpace(order.Customer.Name)
		customerEmail = strings.TrimSpace(order.Customer.Email)
		customerLocale = NormalizeLocale(order.Customer.Locale)
	} else if order.CustomerID != nil && strings.TrimSpace(*order.CustomerID) != "" {
		var customer authmodels.Customer
		if err := db.WithContext(ctx).Where("id = ?", *order.CustomerID).First(&customer).Error; err == nil {
			customerName = strings.TrimSpace(customer.Name)
			customerEmail = strings.TrimSpace(customer.Email)
			customerLocale = NormalizeLocale(customer.Locale)
		}
	}
	storeName := "Go Seller"
	var setting settingmodels.Setting
	if err := db.WithContext(ctx).Where("scope = ? AND key = ?", "global", "store.name").First(&setting).Error; err == nil {
		var name string
		if json.Unmarshal(setting.Value, &name) == nil && strings.TrimSpace(name) != "" {
			storeName = name
		}
	}
	paymentStatus := order.PaymentStatus
	if len(order.Payments) > 0 {
		paymentStatus = order.Payments[0].Status
	}
	return map[string]interface{}{
		"order_id":        order.ID,
		"order_number":    order.OrderNumber,
		"order_status":    order.Status,
		"payment_status":  paymentStatus,
		"grand_total":     s.formatAmount(order.GrandTotal),
		"currency":        order.Currency,
		"customer_name":   s.fallbackString(customerName, "Customer"),
		"customer_email":  customerEmail,
		"customer_locale": customerLocale,
		"business_name":   storeName,
		"order_link":      "/admin/orders",
	}
}

func (s *Service) renderTemplate(input string, data map[string]interface{}) (string, error) {
	tpl, err := txttpl.New("notification").Option("missingkey=zero").Parse(input)
	if err != nil {
		return "", err
	}
	buf := bytes.Buffer{}
	if err := tpl.Execute(&buf, data); err != nil {
		return "", err
	}
	return strings.TrimSpace(buf.String()), nil
}

func (s *Service) splitRecipients(value string) []string {
	value = strings.NewReplacer(";", ",", "\n", ",").Replace(value)
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	seen := map[string]struct{}{}
	for _, part := range parts {
		email := strings.TrimSpace(part)
		if email == "" {
			continue
		}
		if _, ok := seen[email]; ok {
			continue
		}
		seen[email] = struct{}{}
		result = append(result, email)
	}
	return result
}

func (s *Service) fallbackString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func (s *Service) formatAmount(value float64) string {
	return strconv.FormatFloat(value, 'f', 2, 64)
}
