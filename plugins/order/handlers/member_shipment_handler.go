package handlers

import (
	"errors"
	"net/http"
	"strings"

	catalogservices "go_framework/plugins/catalog/services"
	ordermodels "go_framework/plugins/order/models"
	ordersvc "go_framework/plugins/order/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type MemberShipmentHandler struct {
	svc        *ordersvc.ShipmentService
	orderSvc   *ordersvc.OrderService
	catalogSvc *catalogservices.CatalogService
}

func NewMemberShipmentHandler(svc *ordersvc.ShipmentService, orderSvc *ordersvc.OrderService, catalogSvc *catalogservices.CatalogService) *MemberShipmentHandler {
	return &MemberShipmentHandler{svc: svc, orderSvc: orderSvc, catalogSvc: catalogSvc}
}

func (h *MemberShipmentHandler) loadAccessibleOrder(c *gin.Context, orderID string) (*ordermodels.Order, bool) {
	return memberOrderAccess(c, h.orderSvc, h.catalogSvc, strings.TrimSpace(c.Param("business_id")), orderID)
}

func (h *MemberShipmentHandler) ListShipments(c *gin.Context) {
	if _, ok := h.loadAccessibleOrder(c, c.Param("order_id")); !ok {
		return
	}
	shipments, err := h.svc.ListShipments(c.Request.Context(), c.Param("order_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": shipments})
}

func (h *MemberShipmentHandler) ShippableItems(c *gin.Context) {
	if _, ok := h.loadAccessibleOrder(c, c.Param("order_id")); !ok {
		return
	}
	items, err := h.svc.ShippableItems(c.Request.Context(), c.Param("order_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *MemberShipmentHandler) CreateShipment(c *gin.Context) {
	if _, ok := h.loadAccessibleOrder(c, c.Param("order_id")); !ok {
		return
	}
	var req createShipmentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	s, err := h.svc.CreateShipment(c.Request.Context(), ordersvc.CreateShipmentInput{
		OrderID:           c.Param("order_id"),
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

func (h *MemberShipmentHandler) GetShipment(c *gin.Context) {
	shipment, err := h.svc.GetShipmentByID(c.Request.Context(), c.Param("shipment_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "shipment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(shipment.OrderID) != strings.TrimSpace(c.Param("order_id")) {
		c.JSON(http.StatusNotFound, gin.H{"error": "shipment not found"})
		return
	}
	if _, ok := h.loadAccessibleOrder(c, shipment.OrderID); !ok {
		return
	}
	c.JSON(http.StatusOK, shipment)
}

func (h *MemberShipmentHandler) UpdateShipment(c *gin.Context) {
	shipment, err := h.svc.GetShipmentByID(c.Request.Context(), c.Param("shipment_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "shipment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(shipment.OrderID) != strings.TrimSpace(c.Param("order_id")) {
		c.JSON(http.StatusNotFound, gin.H{"error": "shipment not found"})
		return
	}
	if _, ok := h.loadAccessibleOrder(c, shipment.OrderID); !ok {
		return
	}
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

func (h *MemberShipmentHandler) DeleteShipment(c *gin.Context) {
	shipment, err := h.svc.GetShipmentByID(c.Request.Context(), c.Param("shipment_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "shipment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(shipment.OrderID) != strings.TrimSpace(c.Param("order_id")) {
		c.JSON(http.StatusNotFound, gin.H{"error": "shipment not found"})
		return
	}
	if _, ok := h.loadAccessibleOrder(c, shipment.OrderID); !ok {
		return
	}
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
