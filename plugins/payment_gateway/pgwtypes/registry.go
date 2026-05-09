// Package pgwtypes — registry adapter pembayaran.
package pgwtypes

import "fmt"

// Registry menyimpan semua adapter pembayaran yang terdaftar.
type Registry struct {
	adapters map[string]Adapter
}

// NewRegistry membuat registry baru.
func NewRegistry() *Registry {
	return &Registry{adapters: make(map[string]Adapter)}
}

// Register mendaftarkan adapter ke registry.
// Panik jika adapter dengan ProviderKey yang sama sudah terdaftar.
func (r *Registry) Register(a Adapter) {
	key := a.ProviderKey()
	if _, exists := r.adapters[key]; exists {
		panic(fmt.Sprintf("payment_gateway: adapter for provider_key %q already registered", key))
	}
	r.adapters[key] = a
}

// Get mengambil adapter berdasarkan provider_key.
// Mengembalikan nil, false jika tidak ditemukan.
func (r *Registry) Get(providerKey string) (Adapter, bool) {
	a, ok := r.adapters[providerKey]
	return a, ok
}

// MustGet mengambil adapter berdasarkan provider_key.
// Mengembalikan error jika tidak ditemukan.
func (r *Registry) MustGet(providerKey string) (Adapter, error) {
	a, ok := r.adapters[providerKey]
	if !ok {
		return nil, fmt.Errorf("payment_gateway: no adapter registered for provider_key %q", providerKey)
	}
	return a, nil
}
