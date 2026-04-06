package handlers

import (
	"errors"
	"net/http"
	"strings"

	"go_framework/plugins/auth/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CustomerAddressHandler struct {
	svc *services.AuthService
}

func NewCustomerAddressHandler(svc *services.AuthService) *CustomerAddressHandler {
	return &CustomerAddressHandler{svc: svc}
}

type customerAddressRequest struct {
	Label        string         `json:"label"`
	ReceiverName string         `json:"receiver_name" binding:"required"`
	PhoneNumber  string         `json:"phone_number" binding:"required"`
	AddressLine1 string         `json:"address_line_1" binding:"required"`
	AddressLine2 *string        `json:"address_line_2"`
	Subdistrict  *string        `json:"subdistrict"`
	District     *string        `json:"district"`
	City         string         `json:"city" binding:"required"`
	Province     string         `json:"province" binding:"required"`
	PostalCode   string         `json:"postal_code" binding:"required"`
	Country      string         `json:"country"`
	Notes        *string        `json:"notes"`
	IsPrimary    bool           `json:"is_primary"`
	Metadata     map[string]any `json:"metadata"`
}

func (h *CustomerAddressHandler) inputFromRequest(req customerAddressRequest) services.CustomerAddressInput {
	return services.CustomerAddressInput{
		Label:        req.Label,
		ReceiverName: req.ReceiverName,
		PhoneNumber:  req.PhoneNumber,
		AddressLine1: req.AddressLine1,
		AddressLine2: req.AddressLine2,
		Subdistrict:  req.Subdistrict,
		District:     req.District,
		City:         req.City,
		Province:     req.Province,
		PostalCode:   req.PostalCode,
		Country:      req.Country,
		Notes:        req.Notes,
		IsPrimary:    req.IsPrimary,
		Metadata:     req.Metadata,
	}
}

func customerIDParamOrContext(c *gin.Context) string {
	if value := strings.TrimSpace(c.Param("id")); value != "" {
		return value
	}
	return strings.TrimSpace(c.GetString("customer_id"))
}

func (h *CustomerAddressHandler) MeList(c *gin.Context) {
	customerID := customerIDParamOrContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}
	items, err := h.svc.ListCustomerAddresses(c.Request.Context(), customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *CustomerAddressHandler) MeGetByID(c *gin.Context) {
	customerID := customerIDParamOrContext(c)
	item, err := h.svc.GetCustomerAddressByID(c.Request.Context(), customerID, c.Param("address_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "address not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *CustomerAddressHandler) MeCreate(c *gin.Context) {
	customerID := customerIDParamOrContext(c)
	if customerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer authentication required"})
		return
	}
	var req customerAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.svc.CreateCustomerAddress(c.Request.Context(), customerID, h.inputFromRequest(req))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": item})
}

func (h *CustomerAddressHandler) MeUpdate(c *gin.Context) {
	customerID := customerIDParamOrContext(c)
	var req customerAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.svc.UpdateCustomerAddress(c.Request.Context(), customerID, c.Param("address_id"), h.inputFromRequest(req))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "address not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *CustomerAddressHandler) MeDelete(c *gin.Context) {
	customerID := customerIDParamOrContext(c)
	affected, err := h.svc.DeleteCustomerAddress(c.Request.Context(), customerID, c.Param("address_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "address not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *CustomerAddressHandler) MeSetPrimary(c *gin.Context) {
	customerID := customerIDParamOrContext(c)
	item, err := h.svc.SetPrimaryCustomerAddress(c.Request.Context(), customerID, c.Param("address_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "address not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *CustomerAddressHandler) AdminList(c *gin.Context)       { h.MeList(c) }
func (h *CustomerAddressHandler) AdminGetByID(c *gin.Context)    { h.MeGetByID(c) }
func (h *CustomerAddressHandler) AdminCreate(c *gin.Context)     { h.MeCreate(c) }
func (h *CustomerAddressHandler) AdminUpdate(c *gin.Context)     { h.MeUpdate(c) }
func (h *CustomerAddressHandler) AdminDelete(c *gin.Context)     { h.MeDelete(c) }
func (h *CustomerAddressHandler) AdminSetPrimary(c *gin.Context) { h.MeSetPrimary(c) }
