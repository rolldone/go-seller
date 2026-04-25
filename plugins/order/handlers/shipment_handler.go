package handlers

import (
	"errors"
	"net/http"

	ordersvc "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ShipmentHandler handles order shipment (resi) endpoints.
type ShipmentHandler struct {
	svc *ordersvc.ShipmentService
}

func NewShipmentHandler(svc *ordersvc.ShipmentService) *ShipmentHandler {
	return &ShipmentHandler{svc: svc}
}

// ListShipments GET /admin/order/orders/:id/shipments
func (h *ShipmentHandler) ListShipments(c *gin.Context) {
	orderID := c.Param("id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order id is required"})
		return
	}
	shipments, err := h.svc.ListShipments(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": shipments})
}

// GetShipment GET /admin/order/shipments/:shipment_id
func (h *ShipmentHandler) GetShipment(c *gin.Context) {
	s, err := h.svc.GetShipmentByID(c.Request.Context(), c.Param("shipment_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "shipment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}

type createShipmentReq struct {
	CarrierName       string   `json:"carrier_name"`
	ServiceName       string   `json:"service_name"`
	TrackingNumber    string   `json:"tracking_number"`
	ShippingAmount    float64  `json:"shipping_amount"`
	EstimatedDelivery string   `json:"estimated_delivery"`
	Description       string   `json:"description"`
	Notes             string   `json:"notes"`
	ItemIDs           []string `json:"item_ids"`
}

// CreateShipment POST /admin/order/orders/:id/shipments
func (h *ShipmentHandler) CreateShipment(c *gin.Context) {
	orderID := c.Param("id")
	var req createShipmentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	s, err := h.svc.CreateShipment(c.Request.Context(), ordersvc.CreateShipmentInput{
		OrderID:           orderID,
		CarrierName:       req.CarrierName,
		ServiceName:       req.ServiceName,
		TrackingNumber:    req.TrackingNumber,
		ShippingAmount:    req.ShippingAmount,
		EstimatedDelivery: req.EstimatedDelivery,
		Description:       req.Description,
		Notes:             req.Notes,
		ItemIDs:           req.ItemIDs,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, s)
}

type updateShipmentReq struct {
	CarrierName       *string  `json:"carrier_name"`
	ServiceName       *string  `json:"service_name"`
	TrackingNumber    *string  `json:"tracking_number"`
	ShippingAmount    *float64 `json:"shipping_amount"`
	EstimatedDelivery *string  `json:"estimated_delivery"`
	Description       *string  `json:"description"`
	Notes             *string  `json:"notes"`
	Status            *string  `json:"status"`
}

// UpdateShipment PATCH /admin/order/shipments/:shipment_id
func (h *ShipmentHandler) UpdateShipment(c *gin.Context) {
	var req updateShipmentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	s, err := h.svc.UpdateShipment(c.Request.Context(), c.Param("shipment_id"), ordersvc.UpdateShipmentInput{
		CarrierName:       req.CarrierName,
		ServiceName:       req.ServiceName,
		TrackingNumber:    req.TrackingNumber,
		ShippingAmount:    req.ShippingAmount,
		EstimatedDelivery: req.EstimatedDelivery,
		Description:       req.Description,
		Notes:             req.Notes,
		Status:            req.Status,
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || err.Error() == "shipment not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "shipment not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, s)
}

// DeleteShipment DELETE /admin/order/shipments/:shipment_id
func (h *ShipmentHandler) DeleteShipment(c *gin.Context) {
	if err := h.svc.DeleteShipment(c.Request.Context(), c.Param("shipment_id")); err != nil {
		if err.Error() == "shipment not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "shipment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "shipment deleted"})
}

// ShippableItems GET /admin/order/orders/:id/shippable-items
func (h *ShipmentHandler) ShippableItems(c *gin.Context) {
	orderID := c.Param("id")
	items, err := h.svc.ShippableItems(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}
