package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	authhandlers "go_framework/plugins/auth/handlers"
	reviewmodels "go_framework/plugins/review/models"
	reviewservices "go_framework/plugins/review/services"

	"github.com/gin-gonic/gin"
)

type ComplaintHandler struct {
	svc *reviewservices.ComplaintService
}

func NewComplaintHandler(svc *reviewservices.ComplaintService) *ComplaintHandler {
	return &ComplaintHandler{svc: svc}
}

func complaintCustomerID(c *gin.Context) string {
	return strings.TrimSpace(c.GetString("customer_id"))
}

func complaintMemberID(c *gin.Context) string {
	return strings.TrimSpace(c.GetString("member_id"))
}

func complaintAdminID(c *gin.Context) string {
	return strings.TrimSpace(c.GetString("admin_id"))
}

type createComplaintRequest struct {
	OrderID string `json:"order_id" binding:"required"`
	Subject string `json:"subject" binding:"required"`
	Body    string `json:"body" binding:"required"`
}

type addComplaintMessageRequest struct {
	Body string `json:"body" binding:"required"`
}

type requestComplaintCloseRequest struct {
	Body string `json:"body"`
}

func (h *ComplaintHandler) RegisterRoutes(admin *gin.RouterGroup, api *gin.RouterGroup) {
	if api != nil {
		customerComplaints := api.Group("/review/complaints")
		customerComplaints.Use(authhandlers.RequireCustomerJWT())
		customerComplaints.POST("", h.CreateMyComplaintCase)
		customerComplaints.GET("", h.ListMyComplaintCases)
		customerComplaints.GET("/:complaint_id", h.GetMyComplaintCase)
		customerComplaints.POST("/:complaint_id/messages", h.AddMyComplaintMessage)

		memberComplaints := api.Group("/member/review/complaints")
		memberComplaints.Use(authhandlers.RequireMemberJWT())
		memberComplaints.GET("", h.ListMemberComplaintCases)
		memberComplaints.GET("/:complaint_id", h.GetMemberComplaintCase)
		memberComplaints.POST("/:complaint_id/messages", h.AddMemberComplaintMessage)
		memberComplaints.POST("/:complaint_id/request-close", h.RequestMemberComplaintClose)
	}

	if admin != nil {
		adminReview := admin.Group("/review")
		adminReview.Use(authhandlers.RequireAdminJWT())
		adminReview.GET("/complaint-reminders", h.ListAdminComplaintReminderLogs)

		adminComplaints := adminReview.Group("/complaints")
		adminComplaints.GET("", h.ListAdminComplaintCases)
		adminComplaints.GET("/:complaint_id", h.GetAdminComplaintCase)
		adminComplaints.POST("/:complaint_id/messages", h.AddAdminComplaintMessage)
		adminComplaints.POST("/:complaint_id/resolve", h.ResolveAdminComplaintCase)
		adminComplaints.POST("/:complaint_id/close", h.CloseAdminComplaintCase)
	}
	if api == nil && admin == nil {
		return
	}
}

func (h *ComplaintHandler) CreateMyComplaintCase(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	customerID := complaintCustomerID(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer auth required"})
		return
	}

	var req createComplaintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	detail, err := h.svc.CreateComplaintCase(c.Request.Context(), reviewservices.CreateComplaintInput{
		OrderID:    req.OrderID,
		CustomerID: customerID,
		Subject:    req.Subject,
		Body:       req.Body,
	})
	if err != nil {
		handleComplaintError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": detail})
}

func (h *ComplaintHandler) ListMyComplaintCases(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	customerID := complaintCustomerID(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer auth required"})
		return
	}
	orderID := strings.TrimSpace(c.Query("order_id"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	cases, total, err := h.svc.ListComplaintCasesByOrder(c.Request.Context(), customerID, orderID, limit, offset)
	if err != nil {
		handleComplaintError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": cases, "total": total, "limit": limit, "offset": offset})
}

func (h *ComplaintHandler) GetMyComplaintCase(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	customerID := complaintCustomerID(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer auth required"})
		return
	}
	detail, err := h.svc.GetComplaintCaseDetail(c.Request.Context(), customerID, c.Param("complaint_id"))
	if err != nil {
		handleComplaintError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": detail})
}

func (h *ComplaintHandler) AddMyComplaintMessage(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	customerID := complaintCustomerID(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer auth required"})
		return
	}

	var req addComplaintMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := h.svc.GetComplaintCaseDetail(c.Request.Context(), customerID, c.Param("complaint_id")); err != nil {
		handleComplaintError(c, err)
		return
	}

	message, err := h.svc.AddComplaintMessage(c.Request.Context(), c.Param("complaint_id"), reviewservices.ComplaintMessageInput{
		SenderType: reviewmodels.ComplaintSenderTypeCustomer,
		SenderID:   customerID,
		Body:       req.Body,
	})
	if err != nil {
		handleComplaintError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": message})
}

func (h *ComplaintHandler) ListMemberComplaintCases(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	memberID := complaintMemberID(c)
	if memberID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member auth required"})
		return
	}
	orderID := strings.TrimSpace(c.Query("order_id"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	cases, total, err := h.svc.ListComplaintCasesByOrderForMember(c.Request.Context(), memberID, orderID, limit, offset)
	if err != nil {
		handleComplaintError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": cases, "total": total, "limit": limit, "offset": offset})
}

func (h *ComplaintHandler) GetMemberComplaintCase(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	memberID := complaintMemberID(c)
	if memberID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member auth required"})
		return
	}
	detail, err := h.svc.GetComplaintCaseDetailForMember(c.Request.Context(), memberID, c.Param("complaint_id"))
	if err != nil {
		handleComplaintError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": detail})
}

func (h *ComplaintHandler) AddMemberComplaintMessage(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	memberID := complaintMemberID(c)
	if memberID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member auth required"})
		return
	}

	var req addComplaintMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := h.svc.GetComplaintCaseDetailForMember(c.Request.Context(), memberID, c.Param("complaint_id")); err != nil {
		handleComplaintError(c, err)
		return
	}

	message, err := h.svc.AddComplaintMessage(c.Request.Context(), c.Param("complaint_id"), reviewservices.ComplaintMessageInput{
		SenderType: reviewmodels.ComplaintSenderTypeMember,
		SenderID:   memberID,
		Body:       req.Body,
	})
	if err != nil {
		handleComplaintError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": message})
}

func (h *ComplaintHandler) RequestMemberComplaintClose(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	memberID := complaintMemberID(c)
	if memberID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "member auth required"})
		return
	}

	var req requestComplaintCloseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := h.svc.GetComplaintCaseDetailForMember(c.Request.Context(), memberID, c.Param("complaint_id")); err != nil {
		handleComplaintError(c, err)
		return
	}

	message, err := h.svc.RequestComplaintClose(c.Request.Context(), c.Param("complaint_id"), reviewservices.ComplaintMessageInput{
		SenderType: reviewmodels.ComplaintSenderTypeMember,
		SenderID:   memberID,
		Body:       req.Body,
	})
	if err != nil {
		handleComplaintError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": message})
}

func (h *ComplaintHandler) ListAdminComplaintCases(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	if complaintAdminID(c) == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "admin auth required"})
		return
	}
	orderID := strings.TrimSpace(c.Query("order_id"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	cases, total, err := h.svc.ListComplaintCasesByOrderForAdmin(c.Request.Context(), orderID, limit, offset)
	if err != nil {
		handleComplaintError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": cases, "total": total, "limit": limit, "offset": offset})
}

func (h *ComplaintHandler) GetAdminComplaintCase(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	if complaintAdminID(c) == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "admin auth required"})
		return
	}
	detail, err := h.svc.GetComplaintCaseDetailForAdmin(c.Request.Context(), complaintAdminID(c), c.Param("complaint_id"))
	if err != nil {
		handleComplaintError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": detail})
}

func (h *ComplaintHandler) AddAdminComplaintMessage(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	adminID := complaintAdminID(c)
	if adminID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "admin auth required"})
		return
	}

	var req addComplaintMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := h.svc.GetComplaintCaseDetailForAdmin(c.Request.Context(), complaintAdminID(c), c.Param("complaint_id")); err != nil {
		handleComplaintError(c, err)
		return
	}

	message, err := h.svc.AddComplaintMessage(c.Request.Context(), c.Param("complaint_id"), reviewservices.ComplaintMessageInput{
		SenderType: reviewmodels.ComplaintSenderTypeAdmin,
		SenderID:   adminID,
		Body:       req.Body,
	})
	if err != nil {
		handleComplaintError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": message})
}

func (h *ComplaintHandler) ResolveAdminComplaintCase(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	if complaintAdminID(c) == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "admin auth required"})
		return
	}
	if err := h.svc.ResolveComplaintCase(c.Request.Context(), c.Param("complaint_id")); err != nil {
		handleComplaintError(c, err)
		return
	}
	detail, err := h.svc.GetComplaintCaseDetailForAdmin(c.Request.Context(), complaintAdminID(c), c.Param("complaint_id"))
	if err != nil {
		handleComplaintError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": detail})
}

func (h *ComplaintHandler) CloseAdminComplaintCase(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	if complaintAdminID(c) == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "admin auth required"})
		return
	}
	if err := h.svc.CloseComplaintCase(c.Request.Context(), c.Param("complaint_id")); err != nil {
		handleComplaintError(c, err)
		return
	}
	detail, err := h.svc.GetComplaintCaseDetailForAdmin(c.Request.Context(), complaintAdminID(c), c.Param("complaint_id"))
	if err != nil {
		handleComplaintError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": detail})
}

func (h *ComplaintHandler) ListAdminComplaintReminderLogs(c *gin.Context) {
	if h == nil || h.svc == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "complaint service not configured"})
		return
	}
	if complaintAdminID(c) == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "admin auth required"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	logs, total, err := h.svc.ListComplaintReminderLogs(c.Request.Context(), reviewservices.ComplaintReminderLogFilter{
		Status:          strings.TrimSpace(c.Query("status")),
		RecipientType:   strings.TrimSpace(c.Query("recipient_type")),
		SenderType:      strings.TrimSpace(c.Query("sender_type")),
		OrderID:         strings.TrimSpace(c.Query("order_id")),
		ComplaintCaseID: strings.TrimSpace(c.Query("complaint_case_id")),
		Query:           strings.TrimSpace(c.Query("q")),
		Page:            page,
		Limit:           limit,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func handleComplaintError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, reviewservices.ErrComplaintCaseNotFound), errors.Is(err, reviewservices.ErrComplaintOrderNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, reviewservices.ErrComplaintNotOwned):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, reviewservices.ErrComplaintCaseClosed):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.Is(err, reviewservices.ErrComplaintBodyRequired), errors.Is(err, reviewservices.ErrComplaintSubjectRequired):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}
