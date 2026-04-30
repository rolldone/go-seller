package payment_gateway

import (
	"sort"
	"sync"

	"go_framework/plugins/payment_gateway/pgwtypes"
)

var (
	gatewayRegistry   = map[string]pgwtypes.PaymentGateway{}
	gatewayRegistryMu sync.RWMutex
)

func RegisterGateway(g pgwtypes.PaymentGateway) {
	if g == nil {
		return
	}
	gatewayRegistryMu.Lock()
	defer gatewayRegistryMu.Unlock()
	gatewayRegistry[g.Key()] = g
}

func GetGateway(key string) (pgwtypes.PaymentGateway, bool) {
	gatewayRegistryMu.RLock()
	defer gatewayRegistryMu.RUnlock()
	g, ok := gatewayRegistry[key]
	return g, ok
}

func RegisteredGateways() []pgwtypes.PaymentGateway {
	gatewayRegistryMu.RLock()
	defer gatewayRegistryMu.RUnlock()

	keys := make([]string, 0, len(gatewayRegistry))
	for key := range gatewayRegistry {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	out := make([]pgwtypes.PaymentGateway, 0, len(keys))
	for _, key := range keys {
		out = append(out, gatewayRegistry[key])
	}
	return out
}

func SupportedProviderKeys() []string {
	gatewayRegistryMu.RLock()
	defer gatewayRegistryMu.RUnlock()

	keys := make([]string, 0, len(gatewayRegistry))
	for key := range gatewayRegistry {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
