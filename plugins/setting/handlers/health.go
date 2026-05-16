package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	pluginservices "go_framework/plugins/setting/services"

	"github.com/gin-gonic/gin"
)

var publicMaintenanceKeyMap = map[string]string{
	"index":                       "maintenance.index",
	"business_page":               "maintenance.business_page",
	"product_detail":              "maintenance.product_detail",
	"order_customer_confirmation": "order.require_customer_confirmation",
}

type SettingHandler struct {
	svc *pluginservices.Service
}

func NewSettingHandler(svc *pluginservices.Service) *SettingHandler {
	return &SettingHandler{svc: svc}
}

// HealthHandler returns a simple health response for the plugin.
func HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "plugin": "setting"})
}

type upsertSettingReq struct {
	Scope       string          `json:"scope"`
	Value       json.RawMessage `json:"value" binding:"required"`
	Description *string         `json:"description"`
}

func readStringSetting(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}

	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return ""
	}

	parsed, ok := value.(string)
	if !ok {
		return ""
	}

	return strings.TrimSpace(parsed)
}

func (h *SettingHandler) List(c *gin.Context) {
	page := 1
	limit := 20
	if v := c.Query("page"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if v := c.Query("limit"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	items, total, err := h.svc.List(c.Request.Context(), pluginservices.ListFilter{
		Scope: c.Query("scope"),
		Query: c.Query("q"),
		Page:  page,
		Limit: limit,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	out := make([]gin.H, 0, len(items))
	for _, setting := range items {
		var parsed any
		if len(setting.Value) > 0 {
			_ = json.Unmarshal(setting.Value, &parsed)
		}
		out = append(out, gin.H{
			"id":          setting.ID,
			"scope":       setting.Scope,
			"key":         setting.Key,
			"value":       parsed,
			"description": setting.Description,
			"created_at":  setting.CreatedAt,
			"updated_at":  setting.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": out, "total": total})
}

func (h *SettingHandler) Get(c *gin.Context) {
	key := c.Param("key")
	scope := c.DefaultQuery("scope", "global")
	// Use GetOrDefault so callers receive a default value when key is missing
	def := []byte("null")
	raw, err := h.svc.GetOrDefault(c.Request.Context(), scope, key, def)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var parsed any
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &parsed)
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id":          nil,
		"scope":       scope,
		"key":         key,
		"value":       parsed,
		"description": nil,
		"created_at":  nil,
		"updated_at":  nil,
	}})
}

func (h *SettingHandler) PublicContact(c *gin.Context) {
	ctx := c.Request.Context()
	addressRaw, err := h.svc.GetOrDefault(ctx, "global", "store.address", []byte(`""`))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	phoneRaw, err := h.svc.GetOrDefault(ctx, "global", "store.phone", []byte(`""`))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	emailRaw, err := h.svc.GetOrDefault(ctx, "global", "store.email", []byte(`""`))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	storeNameRaw, err := h.svc.GetOrDefault(ctx, "global", "store.name", []byte(`""`))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"store_name": readStringSetting(storeNameRaw),
		"address":    readStringSetting(addressRaw),
		"phone":      readStringSetting(phoneRaw),
		"email":      readStringSetting(emailRaw),
	}})
}

func readBoolSetting(raw []byte) bool {
	if len(raw) == 0 {
		return false
	}

	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return false
	}

	parsed, ok := value.(bool)
	if !ok {
		return false
	}

	return parsed
}

func (h *SettingHandler) PublicMaintenance(c *gin.Context) {
	ctx := c.Request.Context()
	wantedKeys := []string{"index", "business_page", "product_detail", "order_customer_confirmation"}
	if queryKeys := strings.TrimSpace(c.Query("keys")); queryKeys != "" {
		parsed := strings.Split(queryKeys, ",")
		wantedKeys = wantedKeys[:0]
		for _, key := range parsed {
			trimmed := strings.TrimSpace(key)
			if trimmed == "" {
				continue
			}
			if _, ok := publicMaintenanceKeyMap[trimmed]; !ok {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid keys parameter"})
				return
			}
			wantedKeys = append(wantedKeys, trimmed)
		}
		if len(wantedKeys) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "keys parameter is required"})
			return
		}
	}

	settingKeys := make([]string, 0, len(wantedKeys))
	defaults := make(map[string][]byte, len(wantedKeys))
	for _, publicKey := range wantedKeys {
		settingKeys = append(settingKeys, publicMaintenanceKeyMap[publicKey])
		defaults[publicKey] = []byte("false")
	}

	values, err := h.svc.GetMany(ctx, "global", settingKeys, defaults)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	data := gin.H{}
	for _, publicKey := range wantedKeys {
		data[publicKey] = readBoolSetting(values[publicMaintenanceKeyMap[publicKey]])
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func (h *SettingHandler) Upsert(c *gin.Context) {
	key := c.Param("key")
	var req upsertSettingReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.Value) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "value is required"})
		return
	}

	setting, err := h.svc.Upsert(c.Request.Context(), req.Scope, key, req.Value, req.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var parsed any
	if len(setting.Value) > 0 {
		_ = json.Unmarshal(setting.Value, &parsed)
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id":          setting.ID,
		"scope":       setting.Scope,
		"key":         setting.Key,
		"value":       parsed,
		"description": setting.Description,
		"created_at":  setting.CreatedAt,
		"updated_at":  setting.UpdatedAt,
	}})
}

func (h *SettingHandler) Delete(c *gin.Context) {
	key := c.Param("key")
	scope := c.DefaultQuery("scope", "global")
	if err := h.svc.DeleteByKey(c.Request.Context(), scope, key); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
