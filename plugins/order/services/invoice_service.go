package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"math"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"go_framework/plugins/order/models"
	settingmodels "go_framework/plugins/setting/models"
)

var ErrInvoiceRenderFailed = errors.New("failed to render invoice pdf")

type invoiceStoreInfo struct {
	Name    string
	Phone   string
	Address string
}

type invoiceItemView struct {
	Name       string
	SKU        string
	Qty        int
	UnitPrice  float64
	BaseAmount float64
	Discount   float64
	TaxType    string
	TaxRate    float64
	TaxAmount  float64
	TaxLabel   string
	LineTotal  float64
}

type invoiceTaxBreakdownView struct {
	TaxType   string
	TaxRate   float64
	TaxAmount float64
	Label     string
}

type invoiceShippingAddressView struct {
	Label        string
	ReceiverName string
	PhoneNumber  string
	Summary      string
}

type invoiceViewData struct {
	Store              invoiceStoreInfo
	OrderNumber        string
	Channel            string
	Status             string
	PaymentStatus      string
	Currency           string
	CreatedAt          time.Time
	PaidAt             *time.Time
	CustomerName       string
	CustomerEmail      string
	CustomerPhone      string
	CustomerLabel      string
	BusinessID         string
	Notes              string
	Items              []invoiceItemView
	AppliedCoupons     []models.OrderCoupon
	Subtotal           float64
	DiscountAmount     float64
	TaxAmount          float64
	ShippingAmount     float64
	GrandTotal         float64
	IsProvisional      bool
	ProvisionalReasons []string
	TaxBreakdown       []invoiceTaxBreakdownView
	ShippingAddress    *invoiceShippingAddressView
}

type wkhtmlRenderRequest struct {
	HTML           string         `json:"html"`
	Options        map[string]any `json:"options,omitempty"`
	TimeoutSeconds int            `json:"timeout_seconds"`
}

type wkhtmlErrorResponse struct {
	Detail string `json:"detail"`
	Error  string `json:"error"`
	Msg    string `json:"message"`
}

const invoiceHTMLTemplate = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice {{ .OrderNumber }}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      font-size: 12px;
      line-height: 1.45;
      background: #ffffff;
    }
    h1, h2, h3, p { margin: 0; }
    .header {
      display: table;
      width: 100%;
      margin-bottom: 24px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 16px;
    }
    .header-left,
    .header-right {
      display: table-cell;
      vertical-align: top;
      width: 50%;
    }
    .header-right {
      text-align: right;
    }
    .store-name {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .title {
      font-size: 30px;
      font-weight: 700;
      letter-spacing: 0.08em;
    }
		.provisional {
			background: #fff7ed;
			border: 1px solid #ffd8a8;
			color: #92400e;
			padding: 10px 12px;
			border-radius: 8px;
			margin-top: 10px;
		}
    .muted { color: #475569; }
    .meta {
      display: table;
      width: 100%;
      margin-bottom: 20px;
    }
    .meta-col {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding-right: 16px;
    }
    .meta-card {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 14px;
      min-height: 120px;
    }
    .section-label {
      font-size: 11px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th {
      background: #f8fafc;
      color: #334155;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      text-align: left;
      border-bottom: 1px solid #cbd5e1;
      padding: 10px 8px;
    }
    td {
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 8px;
      vertical-align: top;
    }
    .text-right { text-align: right; }
    .summary {
      width: 360px;
      margin-left: auto;
      margin-top: 18px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
    }
    .summary-row {
      display: table;
      width: 100%;
      border-bottom: 1px solid #e2e8f0;
    }
    .summary-row:last-child { border-bottom: 0; }
    .summary-label,
    .summary-value {
      display: table-cell;
      padding: 10px 14px;
    }
    .summary-label { color: #475569; }
    .summary-value {
      text-align: right;
      font-weight: 600;
    }
    .summary-total {
      background: #0f172a;
      color: #ffffff;
    }
    .notes,
    .coupons {
      margin-top: 20px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 14px;
    }
    .footer {
      margin-top: 28px;
      font-size: 11px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="store-name">{{ .Store.Name }}</div>
      <p class="muted">{{ .Store.Address }}</p>
      <p class="muted">{{ .Store.Phone }}</p>
    </div>
    <div class="header-right">
      <div class="title">INVOICE</div>
      <p><strong>{{ .OrderNumber }}</strong></p>
      <p class="muted">Dibuat: {{ formatTime .CreatedAt }}</p>
      <p class="muted">Status: {{ .Status }} / {{ .PaymentStatus }}</p>
      {{ if .PaidAt }}<p class="muted">Dibayar: {{ formatTimePtr .PaidAt }}</p>{{ end }}
			{{ if .IsProvisional }}
			<div class="provisional">
				<strong>INVOICE SEMENTARA</strong> — Dokumen ini belum sah; {{ range $i, $r := .ProvisionalReasons }}{{ if $i }}, {{ end }}{{ $r }}{{ end }}. Invoice resmi akan diterbitkan setelah konfirmasi.
			</div>
			{{ end }}
    </div>
  </div>

  <div class="meta">
    <div class="meta-col">
      <div class="meta-card">
        <div class="section-label">Pelanggan</div>
        <p><strong>{{ .CustomerName }}</strong></p>
        <p class="muted">{{ .CustomerEmail }}</p>
        <p class="muted">{{ .CustomerPhone }}</p>
        <p class="muted">{{ .CustomerLabel }}</p>
      </div>
    </div>
    <div class="meta-col">
      <div class="meta-card">
        <div class="section-label">Order</div>
        <p><strong>Channel:</strong> {{ .Channel }}</p>
        <p><strong>Business ID:</strong> {{ .BusinessID }}</p>
        <p><strong>Mata Uang:</strong> {{ .Currency }}</p>
      </div>
    </div>
  </div>

	{{ if .ShippingAddress }}
	<div class="notes">
		<div class="section-label">Alamat Pengiriman</div>
		<p><strong>{{ .ShippingAddress.ReceiverName }}</strong>{{ if .ShippingAddress.Label }} ({{ .ShippingAddress.Label }}){{ end }}</p>
		<p class="muted">{{ .ShippingAddress.PhoneNumber }}</p>
		<p>{{ .ShippingAddress.Summary }}</p>
	</div>
	{{ end }}

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Subtotal</th>
        <th class="text-right">Diskon</th>
			<th class="text-right">Pajak</th>
        <th class="text-right">Line Total</th>
      </tr>
    </thead>
    <tbody>
      {{ range .Items }}
      <tr>
        <td>
          <strong>{{ .Name }}</strong>
          {{ if .SKU }}<div class="muted">SKU: {{ .SKU }}</div>{{ end }}
        </td>
        <td class="text-right">{{ .Qty }}</td>
        <td class="text-right">{{ money $.Currency .UnitPrice }}</td>
        <td class="text-right">{{ money $.Currency .BaseAmount }}</td>
        <td class="text-right">{{ money $.Currency .Discount }}</td>
		<td class="text-right">
		  <div><strong>{{ .TaxLabel }}</strong></div>
		  <div class="muted">{{ money $.Currency .TaxAmount }}</div>
		</td>
        <td class="text-right">{{ money $.Currency .LineTotal }}</td>
      </tr>
      {{ end }}
    </tbody>
  </table>

  <div class="summary">
    <div class="summary-row">
      <div class="summary-label">Subtotal</div>
      <div class="summary-value">{{ money .Currency .Subtotal }}</div>
    </div>
    <div class="summary-row">
      <div class="summary-label">Diskon</div>
      <div class="summary-value">{{ money .Currency .DiscountAmount }}</div>
    </div>
    <div class="summary-row">
      <div class="summary-label">Pajak</div>
      <div class="summary-value">{{ money .Currency .TaxAmount }}</div>
    </div>
	{{ if .TaxBreakdown }}
	<div class="notes">
	  <div class="section-label">Rincian Pajak</div>
	  {{ range .TaxBreakdown }}
	    <p>{{ .Label }} - {{ money $.Currency .TaxAmount }}</p>
	  {{ end }}
	</div>
	{{ end }}
    <div class="summary-row">
      <div class="summary-label">Ongkir</div>
      <div class="summary-value">{{ money .Currency .ShippingAmount }}</div>
    </div>
    <div class="summary-row summary-total">
      <div class="summary-label">Grand Total</div>
      <div class="summary-value">{{ money .Currency .GrandTotal }}</div>
    </div>
  </div>

  {{ if .AppliedCoupons }}
  <div class="coupons">
    <div class="section-label">Kupon Terpasang</div>
    {{ range .AppliedCoupons }}
      <p>{{ .Code }} ({{ .Category }}) - {{ money $.Currency .DiscountAmount }}</p>
    {{ end }}
  </div>
  {{ end }}

  {{ if .Notes }}
  <div class="notes">
    <div class="section-label">Catatan</div>
    <p>{{ .Notes }}</p>
  </div>
  {{ end }}

  <div class="footer">
    Invoice ini dibuat otomatis dari sistem admin.
  </div>
</body>
</html>`

func (s *OrderService) GenerateInvoicePDF(ctx context.Context, orderID string) ([]byte, string, error) {
	order, err := s.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, "", err
	}

	storeInfo, err := s.loadInvoiceStoreInfo(ctx)
	if err != nil {
		return nil, "", err
	}

	htmlDoc, err := buildInvoiceHTML(order, storeInfo)
	if err != nil {
		return nil, "", err
	}

	pdfBytes, err := renderInvoicePDFWithWKHTML(ctx, htmlDoc)
	if err != nil {
		return nil, "", err
	}

	return pdfBytes, buildInvoiceFilename(order.OrderNumber), nil
}

func (s *OrderService) loadInvoiceStoreInfo(ctx context.Context) (invoiceStoreInfo, error) {
	info := invoiceStoreInfo{Name: "Store", Phone: "-", Address: "-"}

	keys := []string{"store.name", "store.phone", "store.address"}
	var settings []settingmodels.Setting
	if err := s.DB.WithContext(ctx).Where("scope = ? AND key IN ?", "global", keys).Find(&settings).Error; err != nil {
		return info, err
	}

	for _, item := range settings {
		value := parseJSONStringSetting(item.Value)
		if value == "" {
			continue
		}
		switch item.Key {
		case "store.name":
			info.Name = value
		case "store.phone":
			info.Phone = value
		case "store.address":
			info.Address = value
		}
	}

	return info, nil
}

func buildInvoiceHTML(order *models.Order, store invoiceStoreInfo) (string, error) {
	if order == nil {
		return "", errors.New("order is required")
	}

	items := make([]invoiceItemView, 0, len(order.OrderItems))
	taxGroups := make(map[string]*invoiceTaxBreakdownView)
	for _, item := range order.OrderItems {
		name := strings.TrimSpace(item.ProductName)
		if name == "" && item.ProductID != nil {
			name = *item.ProductID
		}
		if name == "" {
			name = "Item"
		}
		sku := ""
		if item.SKU != nil {
			sku = strings.TrimSpace(*item.SKU)
		}
		taxType := normalizeInvoiceTaxType(item.TaxType)
		taxRate := normalizeInvoiceTaxRate(item.TaxRate)
		taxLabel := formatInvoiceTaxLabel(taxType, taxRate)
		key := fmt.Sprintf("%s:%.4f", taxType, taxRate)
		group := taxGroups[key]
		if group == nil {
			group = &invoiceTaxBreakdownView{TaxType: taxType, TaxRate: taxRate, Label: taxLabel}
			taxGroups[key] = group
		}
		group.TaxAmount += item.TaxAmount
		items = append(items, invoiceItemView{
			Name:       name,
			SKU:        sku,
			Qty:        item.Qty,
			UnitPrice:  item.UnitPrice,
			BaseAmount: float64(item.Qty) * item.UnitPrice,
			Discount:   item.DiscountAmount,
			TaxType:    taxType,
			TaxRate:    taxRate,
			TaxAmount:  item.TaxAmount,
			TaxLabel:   taxLabel,
			LineTotal:  item.LineTotal,
		})
	}

	taxBreakdown := make([]invoiceTaxBreakdownView, 0, len(taxGroups))
	for _, group := range taxGroups {
		taxBreakdown = append(taxBreakdown, *group)
	}
	sort.Slice(taxBreakdown, func(i, j int) bool {
		if taxBreakdown[i].TaxRate == taxBreakdown[j].TaxRate {
			return taxBreakdown[i].TaxType < taxBreakdown[j].TaxType
		}
		return taxBreakdown[i].TaxRate > taxBreakdown[j].TaxRate
	})

	// Determine provisional status: missing shipping quote or unconfirmed payment
	reasons := make([]string, 0)
	if !HasReadyShippingQuote(order) {
		reasons = append(reasons, "Ongkos kirim belum final")
	}
	paymentConfirmed := order.PaidAt != nil || strings.EqualFold(strings.TrimSpace(order.PaymentStatus), "paid")
	if !paymentConfirmed {
		reasons = append(reasons, "Pembayaran belum dikonfirmasi")
	}
	isProvisional := len(reasons) > 0

	customerName := "Guest"
	customerEmail := "-"
	customerPhone := "-"
	customerLabel := "-"
	if order.Customer != nil {
		if strings.TrimSpace(order.Customer.Name) != "" {
			customerName = order.Customer.Name
		}
		if strings.TrimSpace(order.Customer.Email) != "" {
			customerEmail = order.Customer.Email
		}
		if strings.TrimSpace(order.Customer.Phone) != "" {
			customerPhone = order.Customer.Phone
		}
		customerLabel = order.Customer.ID
	} else if order.CustomerID != nil && strings.TrimSpace(*order.CustomerID) != "" {
		customerLabel = *order.CustomerID
	}

	businessID := "-"
	if order.BusinessID != nil && strings.TrimSpace(*order.BusinessID) != "" {
		businessID = *order.BusinessID
	}

	notes := ""
	if order.Notes != nil {
		notes = strings.TrimSpace(*order.Notes)
	}

	data := invoiceViewData{
		Store:              store,
		OrderNumber:        order.OrderNumber,
		Channel:            strings.TrimSpace(order.Channel),
		Status:             strings.TrimSpace(order.Status),
		PaymentStatus:      strings.TrimSpace(order.PaymentStatus),
		Currency:           strings.TrimSpace(order.Currency),
		CreatedAt:          order.CreatedAt,
		PaidAt:             order.PaidAt,
		CustomerName:       customerName,
		CustomerEmail:      customerEmail,
		CustomerPhone:      customerPhone,
		CustomerLabel:      customerLabel,
		BusinessID:         businessID,
		Notes:              notes,
		Items:              items,
		AppliedCoupons:     order.OrderCoupons,
		Subtotal:           order.Subtotal,
		DiscountAmount:     order.DiscountAmount,
		TaxAmount:          order.TaxAmount,
		ShippingAmount:     order.ShippingAmount,
		GrandTotal:         order.GrandTotal,
		IsProvisional:      isProvisional,
		ProvisionalReasons: reasons,
		TaxBreakdown:       taxBreakdown,
		ShippingAddress:    extractInvoiceShippingAddress(order),
	}

	tpl, err := template.New("invoice").Funcs(template.FuncMap{
		"money": func(currency string, amount float64) string {
			if strings.TrimSpace(currency) == "" {
				currency = "IDR"
			}
			return fmt.Sprintf("%s %.2f", currency, amount)
		},
		"formatTime": func(value time.Time) string {
			if value.IsZero() {
				return "-"
			}
			return value.Format("02 Jan 2006 15:04")
		},
		"formatTimePtr": func(value *time.Time) string {
			if value == nil || value.IsZero() {
				return "-"
			}
			return value.Format("02 Jan 2006 15:04")
		},
	}).Parse(invoiceHTMLTemplate)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := tpl.Execute(&buf, data); err != nil {
		return "", err
	}

	return buf.String(), nil
}

func renderInvoicePDFWithWKHTML(ctx context.Context, htmlDoc string) ([]byte, error) {
	payload := wkhtmlRenderRequest{
		HTML: htmlDoc,
		Options: map[string]any{
			"encoding":      "utf-8",
			"page-size":     "A4",
			"margin-top":    "12mm",
			"margin-right":  "10mm",
			"margin-bottom": "12mm",
			"margin-left":   "10mm",
		},
		TimeoutSeconds: 45,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, wkhtmlServiceURL(), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/pdf")

	client := &http.Client{Timeout: 50 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvoiceRenderFailed, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		payload := wkhtmlErrorResponse{}
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		_ = json.Unmarshal(data, &payload)
		message := strings.TrimSpace(payload.Detail)
		if message == "" {
			message = strings.TrimSpace(payload.Error)
		}
		if message == "" {
			message = strings.TrimSpace(payload.Msg)
		}
		if message == "" {
			message = strings.TrimSpace(string(data))
		}
		if message == "" {
			message = fmt.Sprintf("wkhtml service returned HTTP %d", resp.StatusCode)
		}
		return nil, fmt.Errorf("%w: %s", ErrInvoiceRenderFailed, message)
	}

	pdfBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if len(pdfBytes) == 0 {
		return nil, fmt.Errorf("%w: empty pdf response", ErrInvoiceRenderFailed)
	}
	return pdfBytes, nil
}

func wkhtmlServiceURL() string {
	if value := strings.TrimSpace(os.Getenv("WKHTML_SERVICE_URL")); value != "" {
		return value
	}
	return "http://wkhtmlpdf:8085/render"
}

func parseJSONStringSetting(value []byte) string {
	var text string
	if err := json.Unmarshal(value, &text); err == nil {
		return strings.TrimSpace(text)
	}
	return strings.TrimSpace(string(value))
}

func normalizeInvoiceTaxType(value string) string {
	if strings.EqualFold(strings.TrimSpace(value), "include") {
		return "include"
	}
	return "exclude"
}

func normalizeInvoiceTaxRate(value float64) float64 {
	if value <= 0 {
		return 0
	}
	if value > 1 {
		value = value / 100
	}
	return value
}

func formatInvoiceTaxPercent(rate float64) string {
	if rate <= 0 {
		return "0%"
	}
	rounded := math.Round(rate*10000) / 100
	if rounded == math.Trunc(rounded) {
		return fmt.Sprintf("%.0f%%", rounded)
	}
	return fmt.Sprintf("%.2f%%", rounded)
}

func formatInvoiceTaxLabel(taxType string, taxRate float64) string {
	mode := "Exclude"
	if normalizeInvoiceTaxType(taxType) == "include" {
		mode = "Include"
	}
	return fmt.Sprintf("%s %s", mode, formatInvoiceTaxPercent(taxRate))
}

func extractInvoiceShippingAddress(order *models.Order) *invoiceShippingAddressView {
	if order == nil || len(order.Metadata) == 0 || strings.EqualFold(strings.TrimSpace(string(order.Metadata)), "null") {
		return nil
	}
	var root map[string]any
	if err := json.Unmarshal(order.Metadata, &root); err != nil {
		return nil
	}
	raw, ok := root["shipping_address"]
	if !ok {
		return nil
	}
	addressMap, ok := raw.(map[string]any)
	if !ok {
		return nil
	}
	label := strings.TrimSpace(fmt.Sprintf("%v", addressMap["label"]))
	receiverName := strings.TrimSpace(fmt.Sprintf("%v", addressMap["receiver_name"]))
	phoneNumber := strings.TrimSpace(fmt.Sprintf("%v", addressMap["phone_number"]))
	summary := strings.TrimSpace(fmt.Sprintf("%v", addressMap["address_summary"]))
	if summary == "" {
		parts := make([]string, 0, 7)
		for _, key := range []string{"address_line_1", "address_line_2", "subdistrict", "district", "city", "province", "postal_code"} {
			value := strings.TrimSpace(fmt.Sprintf("%v", addressMap[key]))
			if value != "" && value != "<nil>" {
				parts = append(parts, value)
			}
		}
		summary = strings.Join(parts, ", ")
	}
	if receiverName == "" && phoneNumber == "" && summary == "" {
		return nil
	}
	return &invoiceShippingAddressView{
		Label:        label,
		ReceiverName: receiverName,
		PhoneNumber:  phoneNumber,
		Summary:      summary,
	}
}

func buildInvoiceFilename(orderNumber string) string {
	safe := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			return r
		case r >= 'A' && r <= 'Z':
			return r
		case r >= '0' && r <= '9':
			return r
		case r == '-', r == '_':
			return r
		default:
			return '-'
		}
	}, strings.TrimSpace(orderNumber))
	safe = strings.Trim(safe, "-")
	if safe == "" {
		safe = "order"
	}
	return "invoice-" + safe + ".pdf"
}
