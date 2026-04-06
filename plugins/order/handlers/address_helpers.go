package handlers

import (
	"strings"

	authmodels "go_framework/plugins/auth/models"
	ordersvc "go_framework/plugins/order/services"
)

func shippingAddressSnapshotFromCustomerAddress(addr *authmodels.CustomerAddress) *ordersvc.ShippingAddressSnapshot {
	if addr == nil {
		return nil
	}
	return &ordersvc.ShippingAddressSnapshot{
		AddressID:     addr.ID,
		Label:         addr.Label,
		ReceiverName:  addr.ReceiverName,
		PhoneNumber:   addr.PhoneNumber,
		AddressLine1:  addr.AddressLine1,
		AddressLine2:  addr.AddressLine2,
		Subdistrict:   addr.Subdistrict,
		District:      addr.District,
		City:          addr.City,
		Province:      addr.Province,
		PostalCode:    addr.PostalCode,
		Country:       addr.Country,
		Notes:         addr.Notes,
		IsPrimary:     addr.IsPrimary,
		AddressString: strings.TrimSpace(strings.Join([]string{addr.AddressLine1, valueOrEmpty(addr.AddressLine2), valueOrEmpty(addr.Subdistrict), valueOrEmpty(addr.District), addr.City, addr.Province, addr.PostalCode}, ", ")),
	}
}
