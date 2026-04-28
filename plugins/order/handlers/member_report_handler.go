package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	authmodels "go_framework/plugins/auth/models"
	ordermodels "go_framework/plugins/order/models"
	ordersvc "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
)

func (h *MemberOrderHandler) DownloadReportPDF(c *gin.Context) {
	businessID := strings.TrimSpace(c.Param("business_id"))
	if _, ok := memberBusinessAccess(c, h.catalogSvc, businessID); !ok {
		return
	}

	locale := normalizeReportLocale(c.Query("locale"))
	periodKey, periodLabel, from, to := parseReportPeriod(c.Query("period"), locale)
	orders, err := h.loadReportOrders(c.Request.Context(), businessID, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	business, err := h.loadBusinessSummary(c.Request.Context(), &businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	data := buildBusinessReportPDFData(business, orders, periodKey, periodLabel, locale)
	pdfBytes, filename, err := h.svc.GenerateBusinessReportPDF(c.Request.Context(), data)
	if err != nil {
		if errors.Is(err, ordersvc.ErrReportRenderFailed) {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

func (h *MemberOrderHandler) loadReportOrders(ctx context.Context, businessID string, from, to *time.Time) ([]ordermodels.Order, error) {
	const pageSize = 100
	orders := make([]ordermodels.Order, 0, pageSize)
	page := 1

	for {
		batch, total, err := h.svc.ListOrders(ctx, ordersvc.OrderListFilter{
			BusinessID: businessID,
			From:       from,
			To:         to,
			Page:       page,
			Limit:      pageSize,
			Sort:       "-updated_at",
		})
		if err != nil {
			return nil, err
		}
		orders = append(orders, batch...)
		if len(batch) == 0 || len(orders) >= int(total) || len(batch) < pageSize {
			break
		}
		page++
	}

	return orders, nil
}

func buildBusinessReportPDFData(business *publicBusinessSummary, orders []ordermodels.Order, periodKey, periodLabel, locale string) ordersvc.BusinessReportPDFData {
	data := ordersvc.BusinessReportPDFData{
		Locale:      locale,
		PeriodKey:   periodKey,
		PeriodLabel: periodLabel,
		GeneratedAt: time.Now(),
	}
	if business != nil {
		shortDescription := ""
		if business.ShortDescription != nil {
			shortDescription = strings.TrimSpace(*business.ShortDescription)
		}
		data.Business = ordersvc.BusinessReportPDFBusiness{
			Name:             business.Name,
			Slug:             business.Slug,
			ShortDescription: shortDescription,
		}
	}

	referenceNow := time.Now()
	trendDays := 14
	switch periodKey {
	case "7d":
		trendDays = 7
	case "90d":
		trendDays = 21
	}
	startOfToday := time.Date(referenceNow.Year(), referenceNow.Month(), referenceNow.Day(), 0, 0, 0, 0, referenceNow.Location())
	revenueByDate := make(map[string]float64)
	productAggregate := make(map[string]*ordersvc.BusinessReportPDFProduct)
	recentOrders := make([]ordersvc.BusinessReportPDFOrderRow, 0, 10)
	paidOrders := 0
	problemOrders := 0
	totalItems := 0
	grossRevenue := 0.0

	for _, order := range orders {
		orderDate := order.UpdatedAt
		if order.PlacedAt != nil {
			orderDate = *order.PlacedAt
		}
		revenueByDate[orderDate.Format("2006-01-02")] += order.GrandTotal
		grossRevenue += order.GrandTotal
		if isReportPaidOrder(order) {
			paidOrders++
		}
		if isReportProblemOrder(order) {
			problemOrders++
		}
		for _, item := range order.OrderItems {
			name := strings.TrimSpace(item.ProductName)
			if name == "" && item.SKU != nil {
				name = strings.TrimSpace(*item.SKU)
			}
			if name == "" {
				name = reportFallbackLabel(locale, "Produk tanpa nama", "Unnamed product")
			}
			aggregated := productAggregate[name]
			if aggregated == nil {
				aggregated = &ordersvc.BusinessReportPDFProduct{Name: name}
				productAggregate[name] = aggregated
			}
			aggregated.Qty += item.Qty
			aggregated.Revenue += item.LineTotal
			totalItems += item.Qty
		}

		if len(recentOrders) < 10 {
			recentOrders = append(recentOrders, ordersvc.BusinessReportPDFOrderRow{
				OrderNumber:   order.OrderNumber,
				OrderDate:     formatReportDate(orderDate),
				Channel:       prettifyReportValue(order.Channel),
				Status:        prettifyReportValue(order.Status),
				PaymentStatus: prettifyReportValue(order.PaymentStatus),
				ItemCount:     len(order.OrderItems),
				GrandTotal:    order.GrandTotal,
				CustomerName:  reportCustomerName(order.Customer),
			})
		}
	}

	trend := make([]ordersvc.BusinessReportPDFTrendPoint, 0, trendDays)
	maxAmount := 0.0
	for offset := trendDays - 1; offset >= 0; offset-- {
		date := startOfToday.AddDate(0, 0, -offset)
		amount := revenueByDate[date.Format("2006-01-02")]
		if amount > maxAmount {
			maxAmount = amount
		}
		trend = append(trend, ordersvc.BusinessReportPDFTrendPoint{
			Label:  date.Format("02 Jan"),
			Amount: amount,
		})
	}
	if maxAmount > 0 {
		for index := range trend {
			trend[index].Percent = (trend[index].Amount / maxAmount) * 100
		}
	}

	topProducts := make([]ordersvc.BusinessReportPDFProduct, 0, len(productAggregate))
	for _, item := range productAggregate {
		topProducts = append(topProducts, *item)
	}
	sort.Slice(topProducts, func(i, j int) bool {
		if topProducts[i].Revenue == topProducts[j].Revenue {
			return topProducts[i].Name < topProducts[j].Name
		}
		return topProducts[i].Revenue > topProducts[j].Revenue
	})
	if len(topProducts) > 5 {
		topProducts = topProducts[:5]
	}

	pendingOrders := len(orders) - paidOrders - problemOrders
	if pendingOrders < 0 {
		pendingOrders = 0
	}

	data.Summary = ordersvc.BusinessReportPDFSummary{
		TotalOrders:   len(orders),
		GrossRevenue:  grossRevenue,
		PaidOrders:    paidOrders,
		PendingOrders: pendingOrders,
		ProblemOrders: problemOrders,
		AverageOrderValue: func() float64 {
			if len(orders) == 0 {
				return 0
			}
			return grossRevenue / float64(len(orders))
		}(),
		TotalItems: totalItems,
	}
	data.Trend = trend
	data.TopProducts = topProducts
	data.Orders = recentOrders
	return data
}

func parseReportPeriod(value string, locale string) (string, string, *time.Time, *time.Time) {
	key := strings.ToLower(strings.TrimSpace(value))
	if key == "" {
		key = "30d"
	}

	now := time.Now()
	end := now
	startOfDay := func(t time.Time) time.Time {
		return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	}
	label := func(idText, enText string) string {
		if strings.EqualFold(strings.TrimSpace(locale), "en") {
			return enText
		}
		return idText
	}

	switch key {
	case "7d":
		start := startOfDay(now.AddDate(0, 0, -6))
		return key, label("7 hari", "7 days"), &start, &end
	case "90d":
		start := startOfDay(now.AddDate(0, 0, -89))
		return key, label("90 hari", "90 days"), &start, &end
	case "all":
		return key, label("Semua data", "All data"), nil, nil
	default:
		key = "30d"
		start := startOfDay(now.AddDate(0, 0, -29))
		return key, label("30 hari", "30 days"), &start, &end
	}
}

func normalizeReportLocale(value string) string {
	if strings.EqualFold(strings.TrimSpace(value), "en") {
		return "en"
	}
	return "id"
}

func reportFallbackLabel(locale, idText, enText string) string {
	if strings.EqualFold(strings.TrimSpace(locale), "en") {
		return enText
	}
	return idText
}

func reportCustomerName(customer *authmodels.Customer) string {
	if customer == nil {
		return "-"
	}
	name := strings.TrimSpace(customer.Name)
	if name != "" {
		return name
	}
	if strings.TrimSpace(customer.Email) != "" {
		return strings.TrimSpace(customer.Email)
	}
	if strings.TrimSpace(customer.Phone) != "" {
		return strings.TrimSpace(customer.Phone)
	}
	return customer.ID
}

func isReportPaidOrder(order ordermodels.Order) bool {
	status := strings.ToLower(strings.TrimSpace(order.PaymentStatus))
	orderStatus := strings.ToLower(strings.TrimSpace(order.Status))
	return status == "paid" || status == "confirmed" || status == "processing" || status == "packed" || status == "shipped" || status == "delivered" || status == "completed" || orderStatus == "paid" || orderStatus == "confirmed" || orderStatus == "processing" || orderStatus == "packed" || orderStatus == "shipped" || orderStatus == "delivered" || orderStatus == "completed"
}

func isReportProblemOrder(order ordermodels.Order) bool {
	status := strings.ToLower(strings.TrimSpace(order.PaymentStatus))
	orderStatus := strings.ToLower(strings.TrimSpace(order.Status))
	return status == "cancelled" || status == "canceled" || status == "expired" || status == "failed" || status == "rejected" || orderStatus == "cancelled" || orderStatus == "canceled" || orderStatus == "expired" || orderStatus == "failed" || orderStatus == "rejected"
}

func prettifyReportValue(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return "-"
	}
	parts := strings.Split(strings.ReplaceAll(trimmed, "_", " "), " ")
	for index, part := range parts {
		if part == "" {
			continue
		}
		parts[index] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
}

func formatReportDate(value time.Time) string {
	return value.Format("02 Jan 2006 15:04")
}
