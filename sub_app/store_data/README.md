# Store Importer

CLI Node.js untuk mengimpor data seed (kategori, produk) ke backend GoSeller.

## Struktur (lokasi saat ini)

```
sub_app/
└── store_data/
  ├── categories.json                 ← base data ringkas (index + relasi)
  ├── categories.translations.id.json ← translate `id` per index
  ├── categories.translations.en.json ← translate `en` per index
  ├── categories_id_map.json          ← ditulis setelah import selesai
    ├── package.json             ← CLI + scripts
    ├── .env.example             ← copy → .env (isi API_URL & ADMIN_TOKEN)
    ├── node_modules/
    └── src/
        ├── index.js             ← CLI entrypoint
        ├── commands/
        │   └── import-categories.js
        └── lib/
            ├── api.js
            └── logger.js
```

> Catatan: importer kini berada langsung di `sub_app/store_data/src`. Jalankan perintah dari folder `sub_app/store_data`.

## Setup

```bash
cd sub_app/store_data
npm install
cp .env.example .env
# edit .env dan isi API_URL serta ADMIN_TOKEN
```

## Cara Kerja `import:categories`

1. Baca `categories.json` sebagai data dasar yang ringkas
2. Ambil translation dari `categories.translations.id.json` dan `categories.translations.en.json` lewat `index`
3. Kelompokkan berdasarkan kedalaman (L1 → L2 → L3)
4. Untuk setiap item, POST ke `/admin/catalog/categories` (locale default: `id`)
5. Backend mengembalikan UUID nyata → disimpan di map `index → UUID`
6. Jika tersedia, PUT terjemahan `en` ke `/admin/catalog/categories/:id/translations/en`
7. Setelah selesai, map disimpan ke `categories_id_map.json`

## Perintah

```bash
# Dry run (lihat payload tanpa mengirim ke API)
node src/index.js import:categories --dry-run

# Import sesungguhnya (pastikan `.env` benar)
node src/index.js import:categories

# Dengan custom delay antar request (ms)
node src/index.js import:categories --delay 500
```

## Environment Variables

| Variable          | Default                   | Keterangan                        |
|-------------------|---------------------------|-----------------------------------|
| API_URL           | http://localhost:8080     | Base URL backend GoSeller         |
| ADMIN_TOKEN       | *(optional)*              | Bearer token admin (preferred)    |
| ADMIN_USERNAME    |                           | Admin email/username for automatic login if `ADMIN_TOKEN` is not set
| ADMIN_PASSWORD    |                           | Admin password for automatic login (keep secure; use staging account)
| BATCH_DELAY_MS    | 200                       | Jeda antar request (ms)           |

## Format `categories.json` (contoh)

```json
[
  {
    "temp_id": "cat-L1-001",
    "parent_temp_id": null,
    "sort_priority": 1,
    "icon_url": null,
    "translations": {
      "id": { "name": "Elektronik", "slug": "elektronik" },
      "en": { "name": "Electronics", "slug": "electronics" }
    }
  }
]
```

- `temp_id` — identifier lokal (tidak dikirim ke backend)
- `parent_temp_id` — referensi parent lokal; akan di-mapping ke UUID saat import
- POST awal mengirimkan locale `id`; translasi `en` diupsert lewat endpoint translation

## Catatan tambahan

- Jika masih ada folder duplikat `sub_app/store_importer`, hapus atau abaikan. Semua tooling aktif saat ini berada di `sub_app/store_data/src`.
- Format split ini sengaja dipakai supaya file utama tetap pendek; key yang dipakai adalah `index`.

### Automatic admin login

- Jika `ADMIN_TOKEN` tidak disediakan dan Anda menjalankan importer tanpa `--dry-run`, importer akan mencoba melakukan login otomatis ke `POST /admin/auth/login` menggunakan `ADMIN_USERNAME` dan `ADMIN_PASSWORD`. Importer akan mengekstrak `access_token` dari respons JSON (`access_token`) dan menggunakannya untuk permintaan admin berikutnya.
- Preferensinya: `ADMIN_TOKEN` (jika ada) > `ADMIN_USERNAME`+`ADMIN_PASSWORD` (jika `ADMIN_TOKEN` kosong).
- Jangan gunakan kredensial admin produksi di environment ini; gunakan akun staging atau admin terbatas. Jangan commit file `.env` yang berisi password.

