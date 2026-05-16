# Panduan `fetchStoreMaintenanceInfo`

Dokumen ini menjelaskan cara memakai helper maintenance yang dipakai di frontend web app.

## Ringkasan

Fungsi utama yang dipakai di project ini adalah `fetchStoreMaintenanceInfo(options?)`.

Lokasi implementasi:
- `src/lib/storeMaintenance.ts`

Helper ini dipakai untuk mengambil status maintenance per segment, bukan semua data sekaligus.

## Signature

```ts
const info = await fetchStoreMaintenanceInfo({
  keys: ["index", "business_page"],
  timeoutMs: 3000,
  cacheTtlMs: 30000,
});
```

Return value:
- `Promise<StoreMaintenanceInfo>`

Type hasil:
- `index: boolean`
- `business_page: boolean`
- `product_detail: boolean`
- `order_customer_confirmation: boolean`

## Cara kerja

`fetchStoreMaintenanceInfo` akan:

1. Mengambil `PUBLIC_API_URL` sebagai base URL backend.
2. Mengirim request ke `/api/settings/maintenance?keys=...`.
3. Menerima response JSON dari backend.
4. Mengisi default `false` jika key tidak ditemukan.
5. Menyimpan cache per kombinasi `keys` untuk mengurangi request berulang.

Kalau `PUBLIC_API_URL` kosong, helper akan langsung error dengan pesan:
- `PUBLIC_API_URL belum dikonfigurasi`

## Parameter

### `keys`

Array key maintenance yang ingin diambil.

Key yang valid saat ini:
- `index`
- `business_page`
- `product_detail`
- `order_customer_confirmation`

Kalau `keys` tidak diisi, helper akan mengambil semua key di atas.

Contoh:

```ts
await fetchStoreMaintenanceInfo({ keys: ["index"] });
await fetchStoreMaintenanceInfo({ keys: ["business_page"] });
await fetchStoreMaintenanceInfo({ keys: ["product_detail"] });
```

### `timeoutMs`

Batas waktu request ke backend. Default:
- `30000` ms

### `cacheTtlMs`

Lama cache disimpan untuk kombinasi key yang sama. Default:
- `30000` ms

### `fetchImpl`

Custom `fetch` implementation untuk testing atau environment khusus.

## Contoh pakai

### 1. Beranda

```ts
const maintenance = await fetchStoreMaintenanceInfo({
  keys: ["index"],
});

if (maintenance.index) {
  // tampilkan maintenance notice
}
```

### 2. Halaman toko

```ts
const maintenance = await fetchStoreMaintenanceInfo({
  keys: ["business_page"],
});

if (maintenance.business_page) {
  // tampilkan maintenance notice
}
```

### 3. Detail produk

```ts
const maintenance = await fetchStoreMaintenanceInfo({
  keys: ["product_detail"],
});

if (maintenance.product_detail) {
  // tampilkan maintenance notice
}
```

### 4. Feature flag order confirmation

```ts
const maintenance = await fetchStoreMaintenanceInfo({
  keys: ["order_customer_confirmation"],
});

if (maintenance.order_customer_confirmation) {
  // aktifkan fitur konfirmasi pelanggan
}
```

## Endpoint yang dipanggil

Helper ini akan memanggil proxy Astro:

- `GET /api/settings/maintenance?keys=index,business_page`

Proxy tersebut akan meneruskan request ke backend settings API.

## Hal yang perlu diingat

- Pakai `keys` yang sesuai segment halaman atau komponen.
- Jangan request semua key kalau hanya butuh satu flag.
- Gunakan helper ini untuk UI publik atau feature flag yang berasal dari backend.
- Kalau `PUBLIC_API_URL` belum diisi, aplikasi sebaiknya dianggap tidak siap jalan.
- Cache dipisahkan per kombinasi key, jadi request `index` dan request `business_page` tidak saling menimpa.

## File terkait

- `src/lib/storeMaintenance.ts`
- `src/pages/api/settings/maintenance.ts`
- `src/pages/index.astro`
- `src/pages/[lang]/index.astro`
- `src/pages/b/[slug].astro`
- `src/pages/[lang]/b/[slug].astro`
- `src/pages/b/[merchant]/p/[slug].astro`
- `src/pages/[lang]/b/[merchant]/p/[slug].astro`
- `src/components/member/orders/OrderDetailModal.tsx`
