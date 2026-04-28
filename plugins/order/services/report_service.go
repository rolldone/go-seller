package services

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"html/template"
	"math"
	"strconv"
	"strings"
	"time"
)

var ErrReportRenderFailed = errors.New("failed to render report pdf")

type BusinessReportPDFBusiness struct {
	Name             string
	Slug             string
	ShortDescription string
}

type BusinessReportPDFSummary struct {
	TotalOrders       int
	GrossRevenue      float64
	PaidOrders        int
	PendingOrders     int
	ProblemOrders     int
	AverageOrderValue float64
	TotalItems        int
}

type BusinessReportPDFTrendPoint struct {
	Label   string
	Amount  float64
	Percent float64
}

type BusinessReportPDFProduct struct {
	Name    string
	Qty     int
	Revenue float64
}

type BusinessReportPDFOrderRow struct {
	OrderNumber   string
	OrderDate     string
	Channel       string
	Status        string
	PaymentStatus string
	ItemCount     int
	GrandTotal    float64
	CustomerName  string
}

type BusinessReportPDFData struct {
	Locale      string
	PeriodKey   string
	PeriodLabel string
	GeneratedAt time.Time
	Business    BusinessReportPDFBusiness
	Summary     BusinessReportPDFSummary
	Trend       []BusinessReportPDFTrendPoint
	TopProducts []BusinessReportPDFProduct
	Orders      []BusinessReportPDFOrderRow
}

const businessReportHTMLTemplate = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>{{ t "Laporan Toko" "Store Report" }} {{ .Business.Name }}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px;
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.45;
    }
    h1, h2, h3, p { margin: 0; }
    .header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 18px;
    }
    .eyebrow {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      background: #ecfdf5;
      color: #047857;
      font-weight: 700;
      letter-spacing: 0.08em;
      font-size: 10px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .title {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .subtle { color: #475569; }
    .meta {
      margin-top: 8px;
      display: table;
      width: 100%;
    }
    .meta-left, .meta-right {
      display: table-cell;
      vertical-align: top;
      width: 50%;
    }
    .meta-right { text-align: right; }
    .section {
      margin-top: 18px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .summary-grid {
      width: 100%;
      margin-bottom: 10px;
    }
    .summary-row {
      width: 100%;
      page-break-inside: avoid;
    }
    .summary-card {
      display: inline-block;
      width: 24%;
      vertical-align: top;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px;
      min-height: 92px;
      margin-right: 1%;
      margin-bottom: 10px;
      background: #fff;
    }
    .summary-card:last-child { margin-right: 0; }
    .summary-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      margin-bottom: 6px;
    }
    .summary-value {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
    }
    .summary-help {
      margin-top: 4px;
      color: #64748b;
      font-size: 11px;
    }
    .bars {
      width: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px;
    }
    .bar-row {
      display: table;
      width: 100%;
      margin-bottom: 8px;
    }
    .bar-row:last-child { margin-bottom: 0; }
    .bar-label, .bar-track, .bar-value {
      display: table-cell;
      vertical-align: middle;
    }
    .bar-label { width: 80px; color: #475569; font-size: 11px; }
    .bar-track { padding: 0 10px; }
    .bar-bg {
      width: 100%;
      height: 12px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #34d399);
      border-radius: 999px;
    }
    .bar-value { width: 110px; text-align: right; font-weight: 700; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th {
      background: #f8fafc;
      color: #334155;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: left;
      padding: 9px 8px;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      border-bottom: 1px solid #e2e8f0;
      padding: 9px 8px;
      vertical-align: top;
    }
    .right { text-align: right; }
    .muted { color: #64748b; }
    .panel {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px;
    }
    .two-col {
      width: 100%;
    }
    .two-col-cell {
      display: inline-block;
      width: 49%;
      vertical-align: top;
    }
    .footer {
      margin-top: 20px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      color: #64748b;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="eyebrow">{{ t "Laporan Toko" "Store Report" }}</div>
    <div class="title">{{ .Business.Name }}</div>
    <p class="subtle">{{ if .Business.ShortDescription }}{{ .Business.ShortDescription }}{{ else }}{{ t "Ringkasan performa toko dan order." "Store performance and order overview." }}{{ end }}</p>
    <div class="meta">
      <div class="meta-left">
        <p><strong>{{ t "Periode" "Period" }}:</strong> {{ .PeriodLabel }}</p>
        <p class="muted"><strong>{{ t "Slug" "Slug" }}:</strong> {{ .Business.Slug }}</p>
      </div>
      <div class="meta-right">
        <p class="muted"><strong>{{ t "Dibuat" "Generated" }}:</strong> {{ formatTime .GeneratedAt }}</p>
        <p class="muted"><strong>{{ t "Total order" "Total orders" }}:</strong> {{ .Summary.TotalOrders }}</p>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">{{ t "Ringkasan Cepat" "Quick Summary" }}</div>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">{{ t "Omzet" "Revenue" }}</div>
        <div class="summary-value">{{ money .Summary.GrossRevenue }}</div>
        <div class="summary-help">{{ t "Nilai transaksi bruto" "Gross transaction value" }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">{{ t "Order selesai" "Completed orders" }}</div>
        <div class="summary-value">{{ .Summary.PaidOrders }}</div>
        <div class="summary-help">{{ t "Sudah dibayar / diproses" "Paid or processed" }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">{{ t "Menunggu tindak lanjut" "Needs follow-up" }}</div>
        <div class="summary-value">{{ .Summary.PendingOrders }}</div>
        <div class="summary-help">{{ t "Perlu dicek tim" "Needs team attention" }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">{{ t "Masalah" "Problems" }}</div>
        <div class="summary-value">{{ .Summary.ProblemOrders }}</div>
        <div class="summary-help">{{ t "Cancel / failed / expired" "Cancel / failed / expired" }}</div>
      </div>
    </div>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">{{ t "AOV" "Average order value" }}</div>
        <div class="summary-value">{{ money .Summary.AverageOrderValue }}</div>
        <div class="summary-help">{{ t "Rata-rata nilai order" "Average order value" }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">{{ t "Item terjual" "Items sold" }}</div>
        <div class="summary-value">{{ .Summary.TotalItems }}</div>
        <div class="summary-help">{{ t "Total qty dari item order" "Total quantity across order items" }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">{{ t "Order terbaru" "Latest orders" }}</div>
        <div class="summary-value">{{ len .Orders }}</div>
        <div class="summary-help">{{ t "Baris terakhir di tabel" "Recent rows in the table" }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">{{ t "Periode" "Period" }}</div>
        <div class="summary-value">{{ .PeriodKey }}</div>
        <div class="summary-help">{{ .PeriodLabel }}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">{{ t "Tren Omzet Harian" "Daily Revenue Trend" }}</div>
    <div class="bars">
      {{ if .Trend }}
        {{ range .Trend }}
          <div class="bar-row">
            <div class="bar-label">{{ .Label }}</div>
            <div class="bar-track"><div class="bar-bg"><div class="bar-fill" style="width: {{ printf "%.0f" .Percent }}%"></div></div></div>
            <div class="bar-value">{{ money .Amount }}</div>
          </div>
        {{ end }}
      {{ else }}
        <p class="muted">{{ t "Belum ada data tren." "No trend data yet." }}</p>
      {{ end }}
    </div>
  </div>

  <div class="section two-col">
    <div class="two-col-cell" style="padding-right: 10px;">
      <div class="section-title">{{ t "Produk Terlaris" "Best-selling products" }}</div>
      <div class="panel">
        {{ if .TopProducts }}
          <table>
            <thead>
              <tr>
                <th>{{ t "Produk" "Product" }}</th>
                <th class="right">{{ t "Qty" "Qty" }}</th>
                <th class="right">{{ t "Omzet" "Revenue" }}</th>
              </tr>
            </thead>
            <tbody>
              {{ range .TopProducts }}
                <tr>
                  <td>{{ .Name }}</td>
                  <td class="right">{{ .Qty }}</td>
                  <td class="right">{{ money .Revenue }}</td>
                </tr>
              {{ end }}
            </tbody>
          </table>
        {{ else }}
          <p class="muted">{{ t "Belum ada produk yang terjual." "No products sold yet." }}</p>
        {{ end }}
      </div>
    </div>
    <div class="two-col-cell" style="padding-left: 10px;">
      <div class="section-title">{{ t "Order Terbaru" "Recent Orders" }}</div>
      <div class="panel">
        {{ if .Orders }}
          <table>
            <thead>
              <tr>
                <th>{{ t "Order" "Order" }}</th>
                <th>{{ t "Tanggal" "Date" }}</th>
                <th>{{ t "Status" "Status" }}</th>
                <th class="right">{{ t "Total" "Total" }}</th>
              </tr>
            </thead>
            <tbody>
              {{ range .Orders }}
                <tr>
                  <td>
                    <div><strong>{{ .OrderNumber }}</strong></div>
                    <div class="muted">{{ .CustomerName }} · {{ .Channel }}</div>
                  </td>
                  <td>{{ .OrderDate }}</td>
                  <td>
                    <div>{{ .Status }}</div>
                    <div class="muted">{{ .PaymentStatus }}</div>
                  </td>
                  <td class="right">
                    <div><strong>{{ money .GrandTotal }}</strong></div>
                    <div class="muted">{{ .ItemCount }} {{ t "item" "item" }}</div>
                  </td>
                </tr>
              {{ end }}
            </tbody>
          </table>
        {{ else }}
          <p class="muted">{{ t "Belum ada order di periode ini." "No orders in this period yet." }}</p>
        {{ end }}
      </div>
    </div>
  </div>

  <div class="footer">{{ t "Dokumen ini dibuat otomatis oleh sistem." "This document was generated automatically by the system." }}</div>
</body>
</html>`

func (s *OrderService) GenerateBusinessReportPDF(ctx context.Context, data BusinessReportPDFData) ([]byte, string, error) {
	if strings.TrimSpace(data.Locale) == "" {
		data.Locale = "id"
	}
	if data.GeneratedAt.IsZero() {
		data.GeneratedAt = time.Now()
	}
	htmlDoc, err := buildBusinessReportHTML(data)
	if err != nil {
		return nil, "", err
	}
	pdfBytes, err := renderInvoicePDFWithWKHTML(ctx, htmlDoc)
	if err != nil {
		return nil, "", fmt.Errorf("%w: %v", ErrReportRenderFailed, err)
	}
	return pdfBytes, buildBusinessReportFilename(data.Business.Slug, data.PeriodKey), nil
}

func buildBusinessReportHTML(data BusinessReportPDFData) (string, error) {
	tpl, err := template.New("business-report").Funcs(template.FuncMap{
		"t": func(idText, enText string) string {
			if strings.EqualFold(strings.TrimSpace(data.Locale), "en") {
				return enText
			}
			return idText
		},
		"money": func(amount float64) string {
			return formatReportMoney(amount)
		},
		"formatTime": func(value time.Time) string {
			if value.IsZero() {
				return "-"
			}
			return value.Format("02 Jan 2006 15:04")
		},
	}).Parse(businessReportHTMLTemplate)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := tpl.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func buildBusinessReportFilename(slug string, periodKey string) string {
	safeSlug := sanitizeReportFilenamePart(slug)
	if safeSlug == "" {
		safeSlug = "business"
	}
	safePeriod := sanitizeReportFilenamePart(periodKey)
	if safePeriod == "" {
		safePeriod = "report"
	}
	return fmt.Sprintf("report-%s-%s.pdf", safeSlug, safePeriod)
}

func sanitizeReportFilenamePart(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return ""
	}
	trimmed = strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			return r
		case r >= '0' && r <= '9':
			return r
		case r == '-' || r == '_':
			return r
		default:
			return '-'
		}
	}, trimmed)
	trimmed = strings.Trim(trimmed, "-")
	for strings.Contains(trimmed, "--") {
		trimmed = strings.ReplaceAll(trimmed, "--", "-")
	}
	return trimmed
}

func formatReportMoney(amount float64) string {
	whole := int64(math.Round(amount))
	negative := whole < 0
	if negative {
		whole = -whole
	}
	digits := strconv.FormatInt(whole, 10)
	for index := len(digits) - 3; index > 0; index -= 3 {
		digits = digits[:index] + "." + digits[index:]
	}
	if negative {
		digits = "-" + digits
	}
	return "Rp " + digits
}
