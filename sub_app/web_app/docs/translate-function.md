# Panduan `useTranslations`

Dokumen ini menjelaskan cara memakai fungsi translate yang dipakai di frontend web app.

## Ringkasan

Fungsi utama yang dipakai di project ini adalah `useTranslations(namespaceOrLang?, lang?)`.

Lokasi implementasi:
- `src/i18n/utils.ts`

Namespace translation yang tersedia saat ini:
- `common`
- `auth`
- `business`

## Signature

```ts
const t = useTranslations(namespaceOrLang?, lang?)
```

Return value:
- `t(key, alternative?) => string`

## Cara kerja

`useTranslations` akan mencari teks dengan urutan berikut:

1. Ambil key dari locale aktif pada namespace yang diminta.
2. Kalau tidak ada, fallback ke default language.
3. Kalau masih tidak ada, pakai `alternative` jika diberikan.
4. Kalau `alternative` juga tidak ada, balikkan `key` itu sendiri.

Default language project ini adalah `id`.

## Cara pakai

### 1. Pakai namespace `common` dengan locale yang sudah diketahui

```tsx
import { useTranslations } from "../../i18n";

export function OrdersHeader({ locale }: { locale: "id" | "en" }) {
  const t = useTranslations("common", locale);

  return <h1>{t("ordersLabel", "Pesanan Saya")}</h1>;
}
```

Pola ini paling aman untuk komponen yang menampilkan UI berdasarkan locale halaman.

### 2. Pakai tanpa namespace eksplisit

```tsx
import { useTranslations } from "../../i18n";

export function EmptyState() {
  const t = useTranslations();

  return <p>{t("noOrders", "Belum ada order.")}</p>;
}
```

Kalau namespace tidak diisi, fungsi akan memakai namespace `common`.

### 3. Pakai namespace selain `common`

```tsx
import { useTranslations } from "../../i18n";

export function LoginTitle({ locale }: { locale: "id" | "en" }) {
  const tAuth = useTranslations("auth", locale);

  return <h1>{tAuth("loginTitle", "Masuk")}</h1>;
}
```

## Contoh key yang umum dipakai

### Status order

```tsx
const t = useTranslations("common", locale);

t("orderStatus.paid", "Lunas");
t("orderStatus.processing", "Diproses");
t("orderStatus.shipped", "Dikirim");
```

### Status delivery

```tsx
t("deliveryStatus.pending", "Belum Dikirim");
t("deliveryStatus.readyToShip", "Siap Kirim");
t("deliveryStatus.delivered", "Terkirim");
```

### Status shipment

```tsx
t("shipmentStatus.inTransit", "Dalam Pengiriman");
t("shipmentStatus.exception", "Ada Masalah");
t("shipmentStatus.returned", "Dikembalikan");
```

## Menambah key baru

Kalau key belum ada, tambahkan ke file locale yang sesuai:

- `src/i18n/locales/id/common.json`
- `src/i18n/locales/en/common.json`

Contoh:

```json
{
  "orderList.shipmentsUnit": "resi"
}
```

Dan versi English-nya:

```json
{
  "orderList.shipmentsUnit": "shipments"
}
```

## Rekomendasi penulisan key

- Gunakan format bertingkat dengan titik, misalnya `orderStatus.paid`.
- Pakai nama key yang deskriptif dan stabil.
- Simpan label UI umum di `common`.
- Simpan label auth di `auth`.
- Simpan label bisnis di `business`.

## Hal yang perlu diingat

- Jangan hard-code label UI kalau key translation sudah tersedia.
- Untuk komponen yang punya locale halaman, selalu kirim `locale` ke `useTranslations`.
- Kalau key belum tersedia, `alternative` bisa dipakai sebagai fallback cepat.
- Kalau `alternative` juga kosong, hasilnya akan balik ke nama key.

## File terkait

- `src/i18n/utils.ts`
- `src/i18n/ui.ts`
- `src/i18n/locales/id/common.json`
- `src/i18n/locales/en/common.json`
