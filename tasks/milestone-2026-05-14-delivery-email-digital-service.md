# Milestone: Delivery Status, Email Designs, Digital & Service Orders

Date: 2026-05-14

Ringkasan singkat
- Tambahkan kolom/flag `delivery_status` di daftar order (admin + member), desain ulang semua template email notifikasi (HTML + plain) untuk event utama, dan definisikan + implementasikan skenario order untuk produk digital dan layanan (service).

Tujuan
- Memudahkan visibility pengiriman di list order bagi admin dan member.
- Menyediakan email notifikasi yang konsisten dan bernilai untuk semua event.
- Menangani fulfillment untuk produk digital (instant delivery) dan produk layanan (scheduling/booking).

Tugas & Sub-tugas

1) Delivery status di order list (member + admin)
- Deskripsi: Tambah `delivery_status` pada response API order list dan detail; tampilkan kolom/label pada list admin dan member.
- Sub-tugas:
  - Backend: pastikan `orders` expose field atau computed `delivery_status` (pending, ready_to_ship, shipped, delivered, returned, exception).
  - API: update `/admin/order/orders` dan `/api/member/businesses/:business_id/orders` response DTOs.
  - Frontend admin: tambah kolom/label pada `OrderList` dan `OrderDetailModal` jika perlu.
  - Frontend member: tambah kolom/label pada `Member Orders` list dan `OrderDetailModal`.
  - Tests: unit test untuk mapping status dan E2E smoke untuk tampilannya.
- Acceptance criteria:
  - `delivery_status` tersedia di API response.
  - Kolom terlihat di admin/member order list dan meng-update sesuai perubahan shipment.
- Estimasi: 1-2 hari
- Priority: High

2) Desain email untuk semua notifikasi
- Deskripsi: Buat HTML + plain templates untuk event notifikasi utama dan tambahkan ke `plugins/notification/defaults.json` (ID + EN).
- Event minimal:
  - order_created, payment_succeeded, payment_failed, payment_refund, shipment_created, shipment_shipped, shipment_delivered, manual_validation, dispute_notification, withdrawal_request, withdrawal_completed
- Sub-tugas:
  - Inventarisasi template yang ada di `plugins/notification/defaults.json`.
  - Desain HTML responsif sederhana + plaintext fallback (ID + EN) untuk setiap event.
  - Tambah templates ke `defaults.json` dan register di service mapping.
  - Tambah preview endpoint atau admin preview page (opsional).
  - Smoke test: kirim sample email lokal (dev) untuk 3 event kunci.
- Acceptance criteria:
  - HTML + plain templates ada untuk setiap event yang tercantum, ada versi `id` dan `en`.
  - Backend build tidak gagal dan notifikasi dapat dikirim (mock/send-local).
- Estimasi: 3-5 hari (tergantung banyaknya event)
- Priority: Medium

3) Skenario order: produk digital
- Deskripsi: Produk digital harus fulfilled segera setelah pembayaran sukses; buyer menerima akses/download/link lisensi via email.
- Sub-tugas:
  - Backend: model/flag untuk digital product (product.type = "digital"); after-payment hook yang membuat delivery token/link.
  - API: expose akses/download via authenticated endpoint (one-time or expiring URL).
  - Email: template `digital_delivery` yang menyertakan link/credential.
  - Tests: simulasikan checkout -> payment succeeded -> delivery link tersedia dan email terkirim.
- Acceptance criteria:
  - Pembeli menerima email dengan link yang dapat digunakan untuk mengunduh/akses asset setelah payment succeeded.
  - Order status berpindah ke `completed` atau `waiting_customer_confirmation` sesuai policy.
- Estimasi: 2-4 hari
- Priority: High (untuk digital goods)

4) Skenario order: produk layanan (service)
- Deskripsi: Produk layanan memerlukan scheduling dan/atau konfirmasi seller; order tidak otomatis `completed` setelah bayar (opsional tergantung konfigurasi service).
- Sub-tugas:
  - Backend: extend product metadata untuk `service` type; implement flow scheduling/appointment record.
  - API: endpoints untuk booking scheduling, seller accept/reject, reschedule.
  - Email: templates `service_booking_requested`, `service_booking_confirmed`, `service_booking_reminder`.
  - Frontend: buyer UI untuk memilih tanggal/waktu saat checkout (atau di page product), seller admin UI untuk approve schedule.
  - Tests: end-to-end booking lifecycle.
- Acceptance criteria:
  - Buyer bisa book time slot, seller bisa confirm, notifikasi email dikirim pada tiap langkah.
  - Order lifecycle tercatat jelas (requested -> confirmed -> completed).
- Estimasi: 3-6 hari
- Priority: Medium

Next steps
- Konfirmasi prioritas dan siapa yang akan mengerjakan tiap tugas.
- Jika setuju, saya bisa mulai implementasi pada `Delivery status` sebagai langkah pertama.

Files created
- `tasks/milestone-2026-05-14-delivery-email-digital-service.md` (ini file).

Jika mau, saya pisahkan tiap tugas ke file terpisah di `tasks/` dan tambahkan checklist granular per file—ingin seperti itu?