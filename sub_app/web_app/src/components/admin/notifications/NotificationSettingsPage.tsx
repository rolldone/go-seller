import { useEffect, useMemo, useState } from "react";

import { notifyError, notifySuccess } from "../../../lib/notification";
import { listSettings, upsertSetting } from "../settings/api";
import { testNotificationTemplate } from "./api";
import type { TestNotificationResponse } from "./api";
import type { SettingItem } from "../settings/types";
import AdminModal from "../ui/AdminModal";

type NotificationAudience = "admin" | "member" | "customer";
type Locale = "id" | "en";

type NotificationTemplate = {
  id: string;
  name: string;
  audience: NotificationAudience;
  description: string;
  enabled: boolean;
  recipients: string;
  subject: string;
  body: string;
};

const LEGACY_TEMPLATE_IDS: Record<string, string[]> = {
  order_created: ["new_order_admin"],
  payment_succeeded: ["processing_order_customer"],
  payment_failed: ["failed_order_admin"],
  team_member_invited_member: ["team_member_invited_admin"],
  team_member_suspended_member: ["team_member_suspended_admin"],
};

const LOCALES: Array<{ value: Locale; label: string }> = [
  { value: "id", label: "Indonesia (id)" },
  { value: "en", label: "English (en)" },
];

const AUDIENCE_OPTIONS: Array<{ value: "all" | NotificationAudience; label: string }> = [
  { value: "all", label: "All audiences" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "customer", label: "Customer" },
];

const AUDIENCE_ORDER: Record<NotificationAudience, number> = {
  admin: 0,
  member: 1,
  customer: 2,
};

const TEMPLATE_META: Array<Pick<NotificationTemplate, "id" | "name" | "audience" | "description">> = [
  {
    id: "order_created",
    name: "Order Created",
    audience: "admin",
    description: "Notifikasi saat order baru masuk.",
  },
  {
    id: "cancelled_order_admin",
    name: "Cancelled Order",
    audience: "admin",
    description: "Notifikasi saat order dibatalkan.",
  },
  {
    id: "payment_succeeded",
    name: "Payment Succeeded",
    audience: "customer",
    description: "Notifikasi saat pembayaran berhasil.",
  },
  {
    id: "customer_confirmation_requested",
    name: "Customer Confirmation Requested",
    audience: "customer",
    description: "Notifikasi saat seller meminta customer mengonfirmasi barang sudah sampai.",
  },
  {
    id: "order_dispute_opened_admin",
    name: "Order Dispute Opened Admin",
    audience: "admin",
    description: "Notifikasi ke admin saat customer membuka dispute order.",
  },
  {
    id: "order_dispute_opened_member",
    name: "Order Dispute Opened Member",
    audience: "member",
    description: "Notifikasi ke seller saat customer membuka dispute order.",
  },
  {
    id: "order_dispute_seller_won_customer",
    name: "Order Dispute Seller Won Customer",
    audience: "customer",
    description: "Notifikasi ke customer saat admin memutuskan dispute untuk seller.",
  },
  {
    id: "order_dispute_seller_won_member",
    name: "Order Dispute Seller Won Member",
    audience: "member",
    description: "Notifikasi ke seller saat admin memutuskan dispute untuk seller.",
  },
  {
    id: "order_dispute_customer_won_customer",
    name: "Order Dispute Customer Won Customer",
    audience: "customer",
    description: "Notifikasi ke customer saat dispute dimenangkan customer dan refund menunggu proses manual.",
  },
  {
    id: "order_dispute_customer_won_member",
    name: "Order Dispute Customer Won Member",
    audience: "member",
    description: "Notifikasi ke seller saat dispute dimenangkan customer.",
  },
  {
    id: "order_dispute_refunded_customer",
    name: "Order Dispute Refunded Customer",
    audience: "customer",
    description: "Notifikasi ke customer saat refund dispute selesai ditandai admin.",
  },
  {
    id: "order_dispute_refunded_member",
    name: "Order Dispute Refunded Member",
    audience: "member",
    description: "Notifikasi ke seller saat refund dispute selesai ditandai admin.",
  },
  {
    id: "payment_failed",
    name: "Payment Failed",
    audience: "admin",
    description: "Notifikasi saat pembayaran gagal.",
  },
  {
    id: "processing_order_customer",
    name: "Processing Order",
    audience: "customer",
    description: "Notifikasi ke customer saat order diproses.",
  },
  {
    id: "completed_order_customer",
    name: "Completed Order",
    audience: "customer",
    description: "Notifikasi ke customer saat order selesai.",
  },
  {
    id: "delivery_status_changed_customer",
    name: "Delivery Status Changed",
    audience: "customer",
    description: "Notifikasi ke customer saat status delivery berubah.",
  },
  {
    id: "customer_forgot_password",
    name: "Customer Forgot Password",
    audience: "customer",
    description: "Notifikasi reset password untuk customer.",
  },
  {
    id: "proof_uploaded_admin",
    name: "Proof Uploaded",
    audience: "admin",
    description: "Notifikasi saat bukti transfer diupload.",
  },
  {
    id: "member_setup_admin",
    name: "Member Setup Admin",
    audience: "admin",
    description: "Notifikasi saat member dan business baru berhasil dibuat.",
  },
  {
    id: "member_setup_member",
    name: "Member Setup Member",
    audience: "member",
    description: "Email onboarding ke member setelah setup berhasil.",
  },
  {
    id: "member_setup_failed_admin",
    name: "Member Setup Failed",
    audience: "admin",
    description: "Notifikasi saat setup member gagal.",
  },
  {
    id: "team_member_invited_member",
    name: "Team Member Invited",
    audience: "member",
    description: "Notifikasi email undangan untuk member.",
  },
  {
    id: "team_member_suspended_member",
    name: "Team Member Suspended",
    audience: "member",
    description: "Notifikasi email saat akses member ditangguhkan.",
  },
  {
    id: "withdrawal_requested_member",
    name: "Withdrawal Requested Member",
    audience: "member",
    description: "Notifikasi saat member mengajukan penarikan dana.",
  },
  {
    id: "withdrawal_requested_admin",
    name: "Withdrawal Requested Admin",
    audience: "admin",
    description: "Notifikasi admin saat ada permintaan penarikan dana.",
  },
  {
    id: "withdrawal_approved_member",
    name: "Withdrawal Approved Member",
    audience: "member",
    description: "Notifikasi saat penarikan dana disetujui.",
  },
  {
    id: "withdrawal_approved_admin",
    name: "Withdrawal Approved Admin",
    audience: "admin",
    description: "Notifikasi admin saat penarikan dana disetujui.",
  },
  {
    id: "withdrawal_rejected_member",
    name: "Withdrawal Rejected Member",
    audience: "member",
    description: "Notifikasi saat penarikan dana ditolak.",
  },
  {
    id: "withdrawal_rejected_admin",
    name: "Withdrawal Rejected Admin",
    audience: "admin",
    description: "Notifikasi admin saat penarikan dana ditolak.",
  },
  {
    id: "withdrawal_processed_member",
    name: "Withdrawal Processed Member",
    audience: "member",
    description: "Notifikasi saat penarikan dana diproses.",
  },
  {
    id: "withdrawal_processed_admin",
    name: "Withdrawal Processed Admin",
    audience: "admin",
    description: "Notifikasi admin saat penarikan dana diproses.",
  },
  {
    id: "settlement_held_member",
    name: "Settlement Held (Member)",
    audience: "member",
    description: "Notifikasi ke member saat settlement escrow ditahan.",
  },
  {
    id: "settlement_held_admin",
    name: "Settlement Held (Admin)",
    audience: "admin",
    description: "Notifikasi admin saat settlement escrow ditahan.",
  },
  {
    id: "settlement_partially_released_member",
    name: "Settlement Partially Released (Member)",
    audience: "member",
    description: "Notifikasi ke member saat settlement escrow partial release.",
  },
  {
    id: "settlement_partially_released_admin",
    name: "Settlement Partially Released (Admin)",
    audience: "admin",
    description: "Notifikasi admin saat settlement escrow partial release.",
  },
  {
    id: "settlement_released_member",
    name: "Settlement Released (Member)",
    audience: "member",
    description: "Notifikasi ke member saat settlement escrow release penuh.",
  },
  {
    id: "settlement_released_admin",
    name: "Settlement Released (Admin)",
    audience: "admin",
    description: "Notifikasi admin saat settlement escrow release penuh.",
  },
  {
    id: "settlement_refunded_member",
    name: "Settlement Refunded (Member)",
    audience: "member",
    description: "Notifikasi ke member saat settlement escrow direfund.",
  },
  {
    id: "settlement_refunded_admin",
    name: "Settlement Refunded (Admin)",
    audience: "admin",
    description: "Notifikasi admin saat settlement escrow direfund.",
  },
  {
    id: "subscription_confirmation_customer",
    name: "Subscription Confirmation",
    audience: "customer",
    description: "Notifikasi saat customer diminta mengonfirmasi langganan email.",
  },
  {
    id: "customer_setup_customer",
    name: "Customer Email Verification",
    audience: "customer",
    description: "Notifikasi verifikasi email saat customer mendaftar.",
  },
];

const TEMPLATE_ORDER = TEMPLATE_META.reduce<Record<string, number>>((acc, item, idx) => {
  acc[item.id] = idx;
  return acc;
}, {});

const DEFAULTS_BY_LOCALE: Record<Locale, Record<string, Pick<NotificationTemplate, "enabled" | "recipients" | "subject" | "body">>> = {
  id: {
    order_created: {
      enabled: true,
      recipients: "admin@goseller.local, owner@goseller.local",
      subject: "[Order Baru] {{.order_number}} - {{.business_name}}",
      body: "Halo Admin, order baru {{.order_number}} dengan total {{.currency}} {{.grand_total}} baru saja dibuat.",
    },
    cancelled_order_admin: {
      enabled: true,
      recipients: "admin@goseller.local",
      subject: "[Order Dibatalkan] {{.order_number}}",
      body: "Order {{.order_number}} dibatalkan. Status order saat ini: {{.order_status}}.",
    },
    payment_succeeded: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Pembayaran order {{.order_number}} berhasil",
      body: "Halo {{.customer_name}}, pembayaran untuk order {{.order_number}} berhasil diterima. Status saat ini: {{.payment_status}}.",
    },
    customer_confirmation_requested: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Konfirmasi penerimaan order {{.order_number}}",
      body: "Halo {{.customer_name}}, seller meminta konfirmasi bahwa order {{.order_number}} sudah sampai. Silakan cek detail order dan pilih terima atau tolak.{{if .confirmation_message}}\n\nPesan seller: {{.confirmation_message}}{{end}}",
    },
    order_dispute_opened_admin: {
      enabled: true,
      recipients: "admin@goseller.local",
      subject: "[Dispute Order] {{.order_number}} butuh review admin",
      body: "Order {{.order_number}} masuk dispute dan menunggu review admin.\n\nCustomer: {{.customer_name}}\nAlasan customer: {{.dispute_customer_reason}}{{if .dispute_confirmation_reject_reason}}\nAlasan tolak konfirmasi: {{.dispute_confirmation_reject_reason}}{{end}}{{if .dispute_seller_note}}\nCatatan seller: {{.dispute_seller_note}}{{end}}",
    },
    order_dispute_opened_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Dispute Order] {{.order_number}} dibuka customer",
      body: "Halo, order {{.order_number}} masuk dispute.\n\nCustomer: {{.customer_name}}\nAlasan customer: {{.dispute_customer_reason}}{{if .dispute_confirmation_reject_reason}}\nAlasan tolak konfirmasi: {{.dispute_confirmation_reject_reason}}{{end}}{{if .dispute_seller_note}}\nCatatan seller saat ini: {{.dispute_seller_note}}{{end}}\n\nSilakan cek detail order dan lengkapi catatan dispute bila perlu.",
    },
    order_dispute_seller_won_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Hasil dispute order {{.order_number}}",
      body: "Halo {{.customer_name}}, dispute untuk order {{.order_number}} telah diputuskan untuk seller. Order dinyatakan selesai.{{if .dispute_admin_note}}\n\nCatatan admin: {{.dispute_admin_note}}{{end}}",
    },
    order_dispute_seller_won_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Dispute Order] {{.order_number}} dimenangkan seller",
      body: "Halo, admin telah memutuskan dispute order {{.order_number}} untuk seller. Order dinyatakan selesai.{{if .dispute_admin_note}}\n\nCatatan admin: {{.dispute_admin_note}}{{end}}",
    },
    order_dispute_customer_won_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Refund diproses untuk dispute order {{.order_number}}",
      body: "Halo {{.customer_name}}, dispute untuk order {{.order_number}} diputuskan untuk customer. Refund sedang diproses manual oleh admin.{{if .dispute_admin_note}}\n\nCatatan admin: {{.dispute_admin_note}}{{end}}",
    },
    order_dispute_customer_won_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Dispute Order] {{.order_number}} diputuskan untuk customer",
      body: "Halo, admin telah memutuskan dispute order {{.order_number}} untuk customer. Refund akan diproses manual.{{if .dispute_admin_note}}\n\nCatatan admin: {{.dispute_admin_note}}{{end}}",
    },
    order_dispute_refunded_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Refund dispute order {{.order_number}} selesai",
      body: "Halo {{.customer_name}}, refund untuk dispute order {{.order_number}} telah diselesaikan admin.{{if .dispute_refund_note}}\n\nCatatan refund: {{.dispute_refund_note}}{{end}}",
    },
    order_dispute_refunded_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Dispute Order] Refund {{.order_number}} selesai",
      body: "Halo, refund untuk dispute order {{.order_number}} telah ditandai selesai oleh admin.{{if .dispute_refund_note}}\n\nCatatan refund: {{.dispute_refund_note}}{{end}}",
    },
    payment_failed: {
      enabled: true,
      recipients: "finance@goseller.local",
      subject: "[Payment Gagal] {{.order_number}}",
      body: "Payment untuk order {{.order_number}} gagal atau ditolak. Status payment: {{.payment_status}}.",
    },
    processing_order_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Order kamu sedang diproses - {{.order_number}}",
      body: "Hi {{.customer_name}}, order {{.order_number}} sudah kami terima dan pembayaran sudah terverifikasi.",
    },
    completed_order_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Order selesai - {{.order_number}}",
      body: "Hi {{.customer_name}}, order {{.order_number}} sudah selesai. Terima kasih sudah belanja.",
    },
    delivery_status_changed_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "[Delivery] {{.order_number}} berubah ke {{.delivery_status}}",
      body: "Halo {{.customer_name}}, status delivery order {{.order_number}} berubah dari {{.previous_delivery_status}} ke {{.delivery_status}}.{{if .carrier_name}}\n\nKurir: {{.carrier_name}}{{end}}{{if .service_name}}\nLayanan: {{.service_name}}{{end}}{{if .tracking_number}}\nResi: {{.tracking_number}}{{end}}{{if .estimated_delivery}}\nEstimasi: {{.estimated_delivery}}{{end}}",
    },
    customer_forgot_password: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Reset password akun GoSeller",
      body: "Halo {{.customer_name}}, kami menerima permintaan reset password. Klik tautan berikut untuk melanjutkan: {{.reset_url}}. Tautan ini berlaku 15 menit.",
    },
    proof_uploaded_admin: {
      enabled: false,
      recipients: "admin@goseller.local",
      subject: "[Bukti Transfer Baru] {{.order_number}}",
      body: "Bukti transfer baru sudah diupload untuk order {{.order_number}}. Silakan cek panel admin.",
    },
    member_setup_admin: {
      enabled: true,
      recipients: "admin@goseller.local",
      subject: "[Member Baru] {{.full_name}} - {{.business_name}}",
      body:
        "Member baru berhasil dibuat. Nama: {{.full_name}} | Email: {{.member_email}} | Business: {{.business_name}} ({{.business_slug}}) | Status: {{.setup_status}}. Menunggu verifikasi email.",
    },
    member_setup_member: {
      enabled: true,
      recipients: "{{.member_email}}",
      subject: "Verifikasi email akun member - {{.business_name}}",
      body:
        "Halo {{.full_name}}, akun member kamu sudah dibuat untuk business {{.business_name}}. Silakan verifikasi email lewat {{.activation_url}}. Setelah itu login via {{.login_url}} menggunakan email dan password yang kamu buat saat setup.",
    },
    member_setup_failed_admin: {
      enabled: true,
      recipients: "admin@goseller.local",
      subject: "[Member Setup Gagal] {{.full_name}}",
      body:
        "Setup member gagal untuk {{.full_name}} ({{.member_email}}) pada business {{.business_name}}. Status: {{.setup_status}}. Pesan: {{.setup_message}}.",
    },
    team_member_invited_member: {
      enabled: true,
      recipients: "{{.member_email}}",
      subject: "[Undangan Tim] {{.business_name}}",
      body:
        "Halo {{.member_name}}, kamu diundang untuk bergabung ke {{.business_name}} sebagai {{.role}}. Klik tautan berikut untuk menerima undangan: {{.invite_url}}.",
    },
    team_member_suspended_member: {
      enabled: true,
      recipients: "{{.member_email}}",
      subject: "[Akses Ditangguhkan] {{.business_name}}",
      body:
        "Halo {{.member_name}}, akses team kamu di {{.business_name}} telah ditangguhkan. Alasan: {{.reason}}. Jika ini terasa keliru, silakan hubungi tim yang mengundangmu.",
    },
    withdrawal_requested_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Penarikan Dana] Permintaan #{{.withdrawal_id}} sedang diproses",
      body: "Halo {{.seller_name}},\n\nPermintaan penarikan dana kamu telah diterima.\n\nID Penarikan: #{{.withdrawal_id}}\nJumlah: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nPermintaan kamu sedang menunggu review admin. Kamu akan mendapat notifikasi setelah status berubah.",
    },
    withdrawal_requested_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Penarikan Dana] Permintaan baru dari {{.seller_name}}",
      body: "Ada permintaan penarikan dana baru.\n\nID Penarikan: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nJumlah: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nSilakan review di panel admin.",
    },
    withdrawal_approved_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Penarikan Dana] Permintaan #{{.withdrawal_id}} disetujui",
      body: "Halo {{.seller_name}},\n\nPermintaan penarikan dana kamu telah disetujui. Dana akan segera ditransfer ke rekening kamu.\n\nID: #{{.withdrawal_id}}\nJumlah: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})",
    },
    withdrawal_approved_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Penarikan Dana] Permintaan #{{.withdrawal_id}} disetujui",
      body: "Permintaan penarikan dana telah disetujui.\n\nID Penarikan: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nJumlah: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nSilakan lanjutkan proses transfer.",
    },
    withdrawal_rejected_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Penarikan Dana] Permintaan #{{.withdrawal_id}} ditolak",
      body: "Halo {{.seller_name}},\n\nSayang sekali, permintaan penarikan dana kamu ditolak.\n\nID Penarikan: #{{.withdrawal_id}}\nJumlah: {{.amount}}\nAlasan: {{.admin_notes}}\n\nSaldo telah dikembalikan ke akun kamu. Silakan hubungi admin jika ada pertanyaan.",
    },
    withdrawal_rejected_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Penarikan Dana] Permintaan #{{.withdrawal_id}} ditolak",
      body: "Permintaan penarikan dana telah ditolak.\n\nID Penarikan: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nJumlah: {{.amount}}\nAlasan: {{.admin_notes}}\n\nSaldo telah dikembalikan ke akun seller.",
    },
    withdrawal_processed_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Penarikan Dana] Permintaan #{{.withdrawal_id}} telah diproses",
      body: "Halo {{.seller_name}},\n\nDana penarikan kamu telah ditransfer.\n\nID Penarikan: #{{.withdrawal_id}}\nJumlah: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nSilakan periksa rekening kamu dalam 1-3 hari kerja.",
    },
    withdrawal_processed_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Penarikan Dana] Permintaan #{{.withdrawal_id}} telah diproses",
      body: "Permintaan penarikan dana telah diproses dan ditransfer.\n\nID Penarikan: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nJumlah: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})",
    },
    settlement_held_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Settlement] Escrow #{{.settlement_id}} ditahan",
      body: "Halo {{.seller_name}},\n\nSettlement escrow untuk order {{.order_id}} saat ini ditahan admin.\n\nSettlement ID: #{{.settlement_id}}\nStatus: {{.status}}\nScope: {{.release_scope}}\nGross: {{.gross_amount}}\nReleased: {{.released_amount}}\nRemaining: {{.remaining_amount}}{{if .admin_notes}}\n\nCatatan admin: {{.admin_notes}}{{end}}",
    },
    settlement_held_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Settlement] Escrow #{{.settlement_id}} ditahan",
      body: "Settlement escrow ditahan admin.\n\nSettlement ID: #{{.settlement_id}}\nOrder ID: {{.order_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nStatus: {{.status}}\nScope: {{.release_scope}}\nGross: {{.gross_amount}}\nReleased: {{.released_amount}}\nRemaining: {{.remaining_amount}}{{if .admin_notes}}\n\nCatatan admin: {{.admin_notes}}{{end}}",
    },
    settlement_partially_released_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Settlement] Escrow #{{.settlement_id}} partial release",
      body: "Halo {{.seller_name}},\n\nSettlement escrow untuk order {{.order_id}} telah di-partial release.\n\nSettlement ID: #{{.settlement_id}}\nNominal release: {{.release_amount}}\nReleased total: {{.released_amount}}\nRemaining: {{.remaining_amount}}\nStatus: {{.status}}{{if .admin_notes}}\n\nCatatan admin: {{.admin_notes}}{{end}}",
    },
    settlement_partially_released_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Settlement] Escrow #{{.settlement_id}} partial release",
      body: "Settlement escrow telah di-partial release.\n\nSettlement ID: #{{.settlement_id}}\nOrder ID: {{.order_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nNominal release: {{.release_amount}}\nReleased total: {{.released_amount}}\nRemaining: {{.remaining_amount}}\nStatus: {{.status}}{{if .admin_notes}}\n\nCatatan admin: {{.admin_notes}}{{end}}",
    },
    settlement_released_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Settlement] Escrow #{{.settlement_id}} released",
      body: "Halo {{.seller_name}},\n\nSettlement escrow untuk order {{.order_id}} sudah direlease penuh.\n\nSettlement ID: #{{.settlement_id}}\nNominal release: {{.release_amount}}\nReleased total: {{.released_amount}}\nRemaining: {{.remaining_amount}}\nStatus: {{.status}}{{if .admin_notes}}\n\nCatatan admin: {{.admin_notes}}{{end}}",
    },
    settlement_released_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Settlement] Escrow #{{.settlement_id}} released",
      body: "Settlement escrow telah direlease penuh.\n\nSettlement ID: #{{.settlement_id}}\nOrder ID: {{.order_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nNominal release: {{.release_amount}}\nReleased total: {{.released_amount}}\nRemaining: {{.remaining_amount}}\nStatus: {{.status}}{{if .admin_notes}}\n\nCatatan admin: {{.admin_notes}}{{end}}",
    },
    settlement_refunded_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Settlement] Escrow #{{.settlement_id}} refunded",
      body: "Halo {{.seller_name}},\n\nSettlement escrow untuk order {{.order_id}} telah direfund.\n\nSettlement ID: #{{.settlement_id}}\nStatus: {{.status}}\nGross: {{.gross_amount}}\nReleased: {{.released_amount}}\nRemaining: {{.remaining_amount}}{{if .admin_notes}}\n\nCatatan admin: {{.admin_notes}}{{end}}",
    },
    settlement_refunded_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Settlement] Escrow #{{.settlement_id}} refunded",
      body: "Settlement escrow telah direfund.\n\nSettlement ID: #{{.settlement_id}}\nOrder ID: {{.order_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nStatus: {{.status}}\nGross: {{.gross_amount}}\nReleased: {{.released_amount}}\nRemaining: {{.remaining_amount}}{{if .admin_notes}}\n\nCatatan admin: {{.admin_notes}}{{end}}",
    },
    subscription_confirmation_customer: {
      enabled: true,
      recipients: "{{.email}}",
      subject: "Konfirmasi langganan - {{.business_name}}",
      body: "Hai {{.Name}},\n\nTerima kasih telah berlangganan {{.business_name}}{{if .ProductName}} - {{.ProductName}}{{end}}.\nSilakan klik tautan berikut untuk mengonfirmasi langganan Anda:\n{{.ConfirmLink}}\n\nTautan ini akan kedaluwarsa dalam {{.ExpiryMinutes}} menit.\n\nJika Anda tidak meminta ini, abaikan saja.",
    },
    customer_setup_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Verifikasi email akun - {{.business_name}}",
      body: "Halo {{.customer_name}},\n\nTerima kasih telah mendaftar. Silakan verifikasi email Anda dengan mengeklik tautan berikut:\n{{.activation_url}}\n\nTautan ini akan kedaluwarsa dalam {{.ExpiryMinutes}} menit.\n\nJika Anda tidak meminta ini, abaikan saja.",
    },
  },
  en: {
    order_created: {
      enabled: true,
      recipients: "admin@goseller.local, owner@goseller.local",
      subject: "[New Order] {{.order_number}} - {{.business_name}}",
      body: "Hello Admin, new order {{.order_number}} with total {{.currency}} {{.grand_total}} has just been created.",
    },
    cancelled_order_admin: {
      enabled: true,
      recipients: "admin@goseller.local",
      subject: "[Order Cancelled] {{.order_number}}",
      body: "Order {{.order_number}} has been cancelled. Current order status: {{.order_status}}.",
    },
    payment_succeeded: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Payment successful - {{.order_number}}",
      body: "Hi {{.customer_name}}, payment for order {{.order_number}} was successful. Current status: {{.payment_status}}.",
    },
    customer_confirmation_requested: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Confirm delivery for order {{.order_number}}",
      body: "Hi {{.customer_name}}, the seller asked you to confirm that order {{.order_number}} has arrived. Please open the order detail and choose accept or reject.{{if .confirmation_message}}\n\nSeller message: {{.confirmation_message}}{{end}}",
    },
    order_dispute_opened_admin: {
      enabled: true,
      recipients: "admin@goseller.local",
      subject: "[Order Dispute] {{.order_number}} needs admin review",
      body: "Order {{.order_number}} is now in dispute and needs admin review.\n\nCustomer: {{.customer_name}}\nCustomer reason: {{.dispute_customer_reason}}{{if .dispute_confirmation_reject_reason}}\nConfirmation rejection reason: {{.dispute_confirmation_reject_reason}}{{end}}{{if .dispute_seller_note}}\nSeller note: {{.dispute_seller_note}}{{end}}",
    },
    order_dispute_opened_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Order Dispute] {{.order_number}} opened by customer",
      body: "Hello, order {{.order_number}} is now in dispute.\n\nCustomer: {{.customer_name}}\nCustomer reason: {{.dispute_customer_reason}}{{if .dispute_confirmation_reject_reason}}\nConfirmation rejection reason: {{.dispute_confirmation_reject_reason}}{{end}}{{if .dispute_seller_note}}\nCurrent seller note: {{.dispute_seller_note}}{{end}}\n\nPlease review the order detail and add a dispute note if needed.",
    },
    order_dispute_seller_won_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Dispute result for order {{.order_number}}",
      body: "Hi {{.customer_name}}, the dispute for order {{.order_number}} has been resolved in favor of the seller. The order is now completed.{{if .dispute_admin_note}}\n\nAdmin note: {{.dispute_admin_note}}{{end}}",
    },
    order_dispute_seller_won_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Order Dispute] {{.order_number}} resolved for seller",
      body: "Hello, admin resolved the dispute for order {{.order_number}} in favor of the seller. The order is now completed.{{if .dispute_admin_note}}\n\nAdmin note: {{.dispute_admin_note}}{{end}}",
    },
    order_dispute_customer_won_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Refund is being prepared for order {{.order_number}}",
      body: "Hi {{.customer_name}}, the dispute for order {{.order_number}} has been resolved in favor of the customer. The refund is being processed manually by admin.{{if .dispute_admin_note}}\n\nAdmin note: {{.dispute_admin_note}}{{end}}",
    },
    order_dispute_customer_won_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Order Dispute] {{.order_number}} resolved for customer",
      body: "Hello, admin resolved the dispute for order {{.order_number}} in favor of the customer. The refund will be handled manually.{{if .dispute_admin_note}}\n\nAdmin note: {{.dispute_admin_note}}{{end}}",
    },
    order_dispute_refunded_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Refund completed for order {{.order_number}}",
      body: "Hi {{.customer_name}}, the refund for disputed order {{.order_number}} has been completed by admin.{{if .dispute_refund_note}}\n\nRefund note: {{.dispute_refund_note}}{{end}}",
    },
    order_dispute_refunded_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Order Dispute] Refund completed for {{.order_number}}",
      body: "Hello, the refund for disputed order {{.order_number}} has been marked completed by admin.{{if .dispute_refund_note}}\n\nRefund note: {{.dispute_refund_note}}{{end}}",
    },
    payment_failed: {
      enabled: true,
      recipients: "finance@goseller.local",
      subject: "[Payment Failed] {{.order_number}}",
      body: "Payment for order {{.order_number}} failed or was rejected. Payment status: {{.payment_status}}.",
    },
    processing_order_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Your order is being processed - {{.order_number}}",
      body: "Hi {{.customer_name}}, your order {{.order_number}} has been received and your payment has been verified.",
    },
    completed_order_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Order completed - {{.order_number}}",
      body: "Hi {{.customer_name}}, your order {{.order_number}} is completed. Thank you for shopping with us.",
    },
    delivery_status_changed_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "[Delivery] {{.order_number}} changed to {{.delivery_status}}",
      body: "Hi {{.customer_name}}, the delivery status for order {{.order_number}} changed from {{.previous_delivery_status}} to {{.delivery_status}}.{{if .carrier_name}}\n\nCarrier: {{.carrier_name}}{{end}}{{if .service_name}}\nService: {{.service_name}}{{end}}{{if .tracking_number}}\nTracking Number: {{.tracking_number}}{{end}}{{if .estimated_delivery}}\nEstimated Delivery: {{.estimated_delivery}}{{end}}",
    },
    customer_forgot_password: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Reset GoSeller account password",
      body: "Hi {{.customer_name}}, we received a password reset request for your account. Click this link to continue: {{.reset_url}}. This link is valid for 15 minutes.",
    },
    proof_uploaded_admin: {
      enabled: false,
      recipients: "admin@goseller.local",
      subject: "[New Transfer Proof] {{.order_number}}",
      body: "A new transfer proof has been uploaded for order {{.order_number}}. Please check the admin panel.",
    },
    member_setup_admin: {
      enabled: true,
      recipients: "admin@goseller.local",
      subject: "[New Member] {{.full_name}} - {{.business_name}}",
      body:
        "A new member has been created. Name: {{.full_name}} | Email: {{.member_email}} | Business: {{.business_name}} ({{.business_slug}}) | Status: {{.setup_status}}. Waiting for email verification.",
    },
    member_setup_member: {
      enabled: true,
      recipients: "{{.member_email}}",
      subject: "Verify your member email - {{.business_name}}",
      body:
        "Hi {{.full_name}}, your member account for {{.business_name}} is ready. Please verify your email via {{.activation_url}}. After that, login via {{.login_url}} using the email and password you created during setup.",
    },
    member_setup_failed_admin: {
      enabled: true,
      recipients: "admin@goseller.local",
      subject: "[Member Setup Failed] {{.full_name}}",
      body:
        "Member setup failed for {{.full_name}} ({{.member_email}}) in {{.business_name}}. Status: {{.setup_status}}. Message: {{.setup_message}}.",
    },
    team_member_invited_member: {
      enabled: true,
      recipients: "{{.member_email}}",
      subject: "[Team Invite] {{.business_name}}",
      body:
        "Hi {{.member_name}}, you have been invited to join {{.business_name}} as {{.role}}. Click here to accept the invitation: {{.invite_url}}.",
    },
    team_member_suspended_member: {
      enabled: true,
      recipients: "{{.member_email}}",
      subject: "[Access Suspended] {{.business_name}}",
      body:
        "Hi {{.member_name}}, your team access for {{.business_name}} has been suspended. Reason: {{.reason}}. If you think this is a mistake, please contact the inviter.",
    },
    withdrawal_requested_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Withdrawal] Request #{{.withdrawal_id}} is being processed",
      body: "Hi {{.seller_name}},\n\nYour withdrawal request has been received.\n\nWithdrawal ID: #{{.withdrawal_id}}\nAmount: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nYour request is pending admin review. You will be notified when the status changes.",
    },
    withdrawal_requested_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Withdrawal] New request from {{.seller_name}}",
      body: "A new withdrawal request has been submitted.\n\nWithdrawal ID: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nAmount: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nPlease review in the admin panel.",
    },
    withdrawal_approved_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Withdrawal] Request #{{.withdrawal_id}} approved",
      body: "Hi {{.seller_name}},\n\nYour withdrawal request has been approved. Funds will be transferred to your bank account shortly.\n\nID: #{{.withdrawal_id}}\nAmount: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})",
    },
    withdrawal_approved_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Withdrawal] Request #{{.withdrawal_id}} approved",
      body: "The withdrawal request has been approved.\n\nWithdrawal ID: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nAmount: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nPlease continue with the transfer process.",
    },
    withdrawal_rejected_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Withdrawal] Request #{{.withdrawal_id}} rejected",
      body: "Hi {{.seller_name}},\n\nWe're sorry, your withdrawal request has been rejected.\n\nWithdrawal ID: #{{.withdrawal_id}}\nAmount: {{.amount}}\nReason: {{.admin_notes}}\n\nThe balance has been returned to your account. Please contact admin if you have any questions.",
    },
    withdrawal_rejected_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Withdrawal] Request #{{.withdrawal_id}} rejected",
      body: "The withdrawal request has been rejected.\n\nWithdrawal ID: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nAmount: {{.amount}}\nReason: {{.admin_notes}}\n\nThe balance has been returned to the seller account.",
    },
    withdrawal_processed_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Withdrawal] Request #{{.withdrawal_id}} has been processed",
      body: "Hi {{.seller_name}},\n\nYour withdrawal funds have been transferred.\n\nWithdrawal ID: #{{.withdrawal_id}}\nAmount: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nPlease check your bank account within 1-3 business days.",
    },
    withdrawal_processed_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Withdrawal] Request #{{.withdrawal_id}} processed",
      body: "The withdrawal request has been processed and transferred.\n\nWithdrawal ID: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nAmount: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})",
    },
    settlement_held_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Settlement] Escrow #{{.settlement_id}} is on hold",
      body: "Hi {{.seller_name}},\n\nThe escrow settlement for order {{.order_id}} is currently on hold by admin.\n\nSettlement ID: #{{.settlement_id}}\nStatus: {{.status}}\nScope: {{.release_scope}}\nGross: {{.gross_amount}}\nReleased: {{.released_amount}}\nRemaining: {{.remaining_amount}}{{if .admin_notes}}\n\nAdmin note: {{.admin_notes}}{{end}}",
    },
    settlement_held_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Settlement] Escrow #{{.settlement_id}} is on hold",
      body: "An escrow settlement has been put on hold by admin.\n\nSettlement ID: #{{.settlement_id}}\nOrder ID: {{.order_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nStatus: {{.status}}\nScope: {{.release_scope}}\nGross: {{.gross_amount}}\nReleased: {{.released_amount}}\nRemaining: {{.remaining_amount}}{{if .admin_notes}}\n\nAdmin note: {{.admin_notes}}{{end}}",
    },
    settlement_partially_released_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Settlement] Escrow #{{.settlement_id}} partially released",
      body: "Hi {{.seller_name}},\n\nThe escrow settlement for order {{.order_id}} has been partially released.\n\nSettlement ID: #{{.settlement_id}}\nReleased amount: {{.release_amount}}\nTotal released: {{.released_amount}}\nRemaining: {{.remaining_amount}}\nStatus: {{.status}}{{if .admin_notes}}\n\nAdmin note: {{.admin_notes}}{{end}}",
    },
    settlement_partially_released_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Settlement] Escrow #{{.settlement_id}} partially released",
      body: "An escrow settlement has been partially released.\n\nSettlement ID: #{{.settlement_id}}\nOrder ID: {{.order_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nReleased amount: {{.release_amount}}\nTotal released: {{.released_amount}}\nRemaining: {{.remaining_amount}}\nStatus: {{.status}}{{if .admin_notes}}\n\nAdmin note: {{.admin_notes}}{{end}}",
    },
    settlement_released_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Settlement] Escrow #{{.settlement_id}} released",
      body: "Hi {{.seller_name}},\n\nThe escrow settlement for order {{.order_id}} has been fully released.\n\nSettlement ID: #{{.settlement_id}}\nReleased amount: {{.release_amount}}\nTotal released: {{.released_amount}}\nRemaining: {{.remaining_amount}}\nStatus: {{.status}}{{if .admin_notes}}\n\nAdmin note: {{.admin_notes}}{{end}}",
    },
    settlement_released_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Settlement] Escrow #{{.settlement_id}} released",
      body: "An escrow settlement has been fully released.\n\nSettlement ID: #{{.settlement_id}}\nOrder ID: {{.order_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nReleased amount: {{.release_amount}}\nTotal released: {{.released_amount}}\nRemaining: {{.remaining_amount}}\nStatus: {{.status}}{{if .admin_notes}}\n\nAdmin note: {{.admin_notes}}{{end}}",
    },
    settlement_refunded_member: {
      enabled: true,
      recipients: "{{.seller_email}}",
      subject: "[Settlement] Escrow #{{.settlement_id}} refunded",
      body: "Hi {{.seller_name}},\n\nThe escrow settlement for order {{.order_id}} has been refunded.\n\nSettlement ID: #{{.settlement_id}}\nStatus: {{.status}}\nGross: {{.gross_amount}}\nReleased: {{.released_amount}}\nRemaining: {{.remaining_amount}}{{if .admin_notes}}\n\nAdmin note: {{.admin_notes}}{{end}}",
    },
    settlement_refunded_admin: {
      enabled: true,
      recipients: "admin@goseller.local, finance@goseller.local",
      subject: "[Settlement] Escrow #{{.settlement_id}} refunded",
      body: "An escrow settlement has been refunded.\n\nSettlement ID: #{{.settlement_id}}\nOrder ID: {{.order_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nStatus: {{.status}}\nGross: {{.gross_amount}}\nReleased: {{.released_amount}}\nRemaining: {{.remaining_amount}}{{if .admin_notes}}\n\nAdmin note: {{.admin_notes}}{{end}}",
    },
    subscription_confirmation_customer: {
      enabled: true,
      recipients: "{{.email}}",
      subject: "Subscription confirmation - {{.business_name}}",
      body: "Hi {{.Name}},\n\nThanks for subscribing to {{.business_name}}{{if .ProductName}} - {{.ProductName}}{{end}}.\nPlease click the link below to confirm your subscription:\n{{.ConfirmLink}}\n\nThis link will expire in {{.ExpiryMinutes}} minutes.\n\nIf you did not request this, please ignore this email.",
    },
    customer_setup_customer: {
      enabled: true,
      recipients: "{{.customer_email}}",
      subject: "Verify your email - {{.business_name}}",
      body: "Hi {{.customer_name}},\n\nThanks for signing up. Please verify your email by clicking the link below:\n{{.activation_url}}\n\nThis link will expire in {{.ExpiryMinutes}} minutes.\n\nIf you did not request this, please ignore this email.",
    },
  },
};

const placeholders = [
  "{{.order_number}}",
  "{{.customer_name}}",
  "{{.customer_email}}",
  "{{.seller_email}}",
  "{{.seller_name}}",
  "{{.settlement_id}}",
  "{{.order_id}}",
  "{{.release_scope}}",
  "{{.gross_amount}}",
  "{{.released_amount}}",
  "{{.remaining_amount}}",
  "{{.release_amount}}",
  "{{.admin_notes}}",
  "{{.full_name}}",
  "{{.member_name}}",
  "{{.member_email}}",
  "{{.business_name}}",
  "{{.business_slug}}",
  "{{.role}}",
  "{{.invited_by_name}}",
  "{{.invited_by_email}}",
  "{{.invite_url}}",
  "{{.reason}}",
  "{{.status}}",
  "{{.payment_status}}",
  "{{.confirmation_message}}",
  "{{.grand_total}}",
  "{{.currency}}",
  "{{.dispute_customer_reason}}",
  "{{.dispute_seller_note}}",
  "{{.dispute_admin_decision}}",
  "{{.dispute_admin_note}}",
  "{{.dispute_refund_note}}",
  "{{.dispute_confirmation_reject_reason}}",
  "{{.order_link}}",
  "{{.login_url}}",
  "{{.activation_url}}",
  "{{.setup_status}}",
  "{{.setup_message}}",
  "{{.reset_url}}",
  "{{.reset_token}}",
  "{{.ConfirmLink}}",
  "{{.ExpiryMinutes}}",
  "{{.Name}}",
  "{{.business_name}}",
  "{{.ProductName}}",
];

const DEFAULT_TEST_VARS = {
  order_number: "TEST-1001",
  order_status: "processing",
  payment_status: "paid",
  seller_email: "seller@example.com",
  seller_name: "Seller Test",
  settlement_id: "101",
  order_id: "ORDER-2026-0001",
  release_scope: "partial",
  gross_amount: "Rp 1.250.000",
  released_amount: "Rp 500.000",
  remaining_amount: "Rp 750.000",
  release_amount: "Rp 500.000",
  admin_notes: "Menunggu verifikasi final dokumen pengiriman",
  grand_total: "123.45",
  currency: "IDR",
  customer_name: "Test Customer",
  customer_email: "test@example.com",
  confirmation_message: "Mohon cek paket yang baru diterima.",
  dispute_customer_reason: "barang rusak saat diterima",
  dispute_seller_note: "seller sudah lampirkan bukti kirim",
  dispute_admin_decision: "open",
  dispute_admin_note: "menunggu verifikasi tambahan",
  dispute_refund_note: "refund diproses manual",
  dispute_confirmation_reject_reason: "paket belum sesuai",
  full_name: "Test Member",
  member_email: "member@example.com",
  business_name: "Go Seller",
  business_slug: "go-seller",
  member_name: "Test Member",
  role: "Editor",
  invited_by_name: "Owner Name",
  invited_by_email: "owner@example.com",
  invite_url: "https://example.com/member/auth/team-invite?token=TEST-INVITE-TOKEN",
  reason: "access suspended for review",
  order_link: "/admin/orders",
  login_url: "https://example.com/login",
  activation_url: "https://example.com/activate?token=TEST-ACTIVATION-TOKEN",
  setup_status: "success",
  setup_message: "member created successfully",
  reset_token: "TEST-RESET-TOKEN",
  reset_url: `${(import.meta.env.PUBLIC_APP_URL ?? "https://example.com").replace(/\/+$/, "")}/customer/auth/reset-password?token=TEST-RESET-TOKEN`,
  ConfirmLink: `${(import.meta.env.PUBLIC_APP_URL ?? "https://example.com").replace(/\/+$/, "")}/subscribe/confirm?token=TEST-CONFIRM-TOKEN`,
  ExpiryMinutes: "1440",
  Name: "Test Customer",
  ProductName: "",
  app_name: "Go Seller",
};
const DEFAULT_TEST_VARS_STRING = JSON.stringify(DEFAULT_TEST_VARS, null, 2);
const DEFAULT_TEST_RECIPIENT = import.meta.env.PUBLIC_TEST_EMAIL_TO ?? "";

const SCOPE = "global";
const KEY_PREFIX = "notifications.";

const getSettingKey = (id: string, locale: Locale) => `${KEY_PREFIX}${id}.${locale}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const buildDefaults = (locale: Locale): NotificationTemplate[] => {
  return TEMPLATE_META.map((meta) => {
    const defaults = DEFAULTS_BY_LOCALE[locale][meta.id];
    return {
      ...meta,
      enabled: defaults.enabled,
      recipients: defaults.recipients,
      subject: defaults.subject,
      body: defaults.body,
    };
  });
};

const coerceTemplate = (fallback: NotificationTemplate, item?: SettingItem): NotificationTemplate => {
  if (!item || !isRecord(item.value)) return fallback;

  return {
    ...fallback,
    enabled: typeof item.value.enabled === "boolean" ? item.value.enabled : fallback.enabled,
    recipients: typeof item.value.recipients === "string" ? item.value.recipients : fallback.recipients,
    subject: typeof item.value.subject === "string" ? item.value.subject : fallback.subject,
    body: typeof item.value.body === "string" ? item.value.body : fallback.body,
  };
};

const resolveTemplateSetting = (settingMap: Map<string, SettingItem>, templateId: string, locale: Locale) => {
  const candidates = [getSettingKey(templateId, locale), ...(LEGACY_TEMPLATE_IDS[templateId] || []).map((legacyId) => getSettingKey(legacyId, locale))];
  for (const key of candidates) {
    const item = settingMap.get(key);
    if (item) return item;
  }
  return undefined;
};

export default function NotificationSettingsPage() {
  const [locale, setLocale] = useState<Locale>("id");
  const [templatesByLocale, setTemplatesByLocale] = useState<Record<Locale, NotificationTemplate[]>>({
    id: buildDefaults("id"),
    en: buildDefaults("en"),
  });
  const [savedByLocale, setSavedByLocale] = useState<Record<Locale, NotificationTemplate[]>>({
    id: buildDefaults("id"),
    en: buildDefaults("en"),
  });
  const [query, setQuery] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<"all" | NotificationAudience>("all");
  const [selectedID, setSelectedID] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testTemplate, setTestTemplate] = useState<NotificationTemplate | null>(null);
  const [testRecipient, setTestRecipient] = useState(DEFAULT_TEST_RECIPIENT);
  const [testVarsInput, setTestVarsInput] = useState(DEFAULT_TEST_VARS_STRING);
  const [testLocale, setTestLocale] = useState<Locale>(locale);
  const [testLoading, setTestLoading] = useState(false);
  const [testPreview, setTestPreview] = useState<TestNotificationResponse | null>(null);

  const templates = templatesByLocale[locale] || [];
  const savedTemplates = savedByLocale[locale] || [];

  const selected = useMemo(
    () => templates.find((item) => item.id === selectedID) || null,
    [templates, selectedID],
  );

  const filteredTemplates = useMemo(() => {
    return templates
      .filter((item) => {
      if (audienceFilter !== "all" && item.audience !== audienceFilter) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q)
      );
      })
      .sort((left, right) => {
        const audienceDiff = AUDIENCE_ORDER[left.audience] - AUDIENCE_ORDER[right.audience];
        if (audienceDiff !== 0) return audienceDiff;
        const leftOrder = TEMPLATE_ORDER[left.id] ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = TEMPLATE_ORDER[right.id] ?? Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder;
      });
  }, [templates, query, audienceFilter]);

  const isDirty = useMemo(
    () => JSON.stringify(templates) !== JSON.stringify(savedTemplates),
    [templates, savedTemplates],
  );

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await listSettings({ q: KEY_PREFIX, scope: SCOPE, page: 1, limit: 200 });
      const settingMap = new Map(res.data.map((item) => [item.key, item]));

      const nextByLocale: Record<Locale, NotificationTemplate[]> = {
        id: buildDefaults("id").map((template) => coerceTemplate(template, resolveTemplateSetting(settingMap, template.id, "id"))),
        en: buildDefaults("en").map((template) => coerceTemplate(template, resolveTemplateSetting(settingMap, template.id, "en"))),
      };

      setTemplatesByLocale(nextByLocale);
      setSavedByLocale(nextByLocale);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal memuat notification settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    setTestLocale(locale);
  }, [locale]);

  const updateTemplate = (id: string, patch: Partial<NotificationTemplate>) => {
    setTemplatesByLocale((prev) => ({
      ...prev,
      [locale]: (prev[locale] || []).map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const resetChanges = () => {
    setTemplatesByLocale((prev) => ({
      ...prev,
      [locale]: savedByLocale[locale] || buildDefaults(locale),
    }));
  };

  const saveTemplates = async () => {
    setSaving(true);
    try {
      await Promise.all(
        templates.map((template) =>
          upsertSetting(getSettingKey(template.id, locale), {
            scope: SCOPE,
            description: `${template.description} (${locale})`,
            value: {
              enabled: template.enabled,
              recipients: template.recipients,
              subject: template.subject,
              body: template.body,
              audience: template.audience,
              name: template.name,
            },
          }),
        ),
      );
      setSavedByLocale((prev) => ({
        ...prev,
        [locale]: templates,
      }));
      notifySuccess(`Notification templates (${locale}) tersimpan`);
      setSelectedID("");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal menyimpan notification settings");
    } finally {
      setSaving(false);
    }
  };

  const openTestModal = (template: NotificationTemplate) => {
    setTestTemplate(template);
    setTestPreview(null);
    setTestVarsInput(DEFAULT_TEST_VARS_STRING);
    setTestLocale(locale);
  };

  const closeTestModal = () => {
    setTestTemplate(null);
    setTestPreview(null);
    setTestLoading(false);
  };

  const handleSendTest = async () => {
    if (!testTemplate) return;
    const recipient = testRecipient.trim();
    if (!recipient) {
      notifyError("Recipient wajib diisi untuk test email");
      return;
    }
    let parsedVars: Record<string, string> = {};
    const trimmedVars = testVarsInput.trim();
    if (trimmedVars) {
      try {
        const parsed = JSON.parse(trimmedVars);
        if (!isRecord(parsed)) {
          throw new Error("Vars harus berupa objek JSON");
        }
        Object.entries(parsed).forEach(([key, value]) => {
          if (!key.trim()) return;
          parsedVars[key] = value === null ? "" : String(value);
        });
      } catch (err) {
        notifyError(err instanceof Error ? err.message : "Vars harus berupa objek JSON");
        return;
      }
    }

    setTestLoading(true);
    try {
      const response = await testNotificationTemplate(testTemplate.id, {
        to: recipient,
        locale: testLocale,
        vars: parsedVars,
      });
      setTestPreview(response);
      notifySuccess(`Test email terkirim ke ${response.sent_to}`);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Gagal mengirim test email");
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Notification Settings</h3>
          <p className="text-sm text-slate-600">Memuat konfigurasi notifikasi...</p>
        </div>
        <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6">
          <div className="space-y-3">
            <div className="h-10 rounded bg-slate-100" />
            <div className="h-10 rounded bg-slate-100" />
            <div className="h-10 rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Notification Settings</h3>
          <p className="text-sm text-slate-600">Kelola template notifikasi per bahasa (id / en).</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTemplates}
            disabled={loading || saving}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={resetChanges}
            disabled={!isDirty || saving}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={saveTemplates}
            disabled={!isDirty || saving}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : `Save ${locale.toUpperCase()}`}
          </button>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={locale}
          onChange={(e) => {
            setLocale(e.target.value as Locale);
            setSelectedID("");
          }}
        >
          {LOCALES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <input
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Search notification"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={audienceFilter}
          onChange={(e) => setAudienceFilter(e.target.value as "all" | NotificationAudience)}
        >
          {AUDIENCE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setAudienceFilter("all");
          }}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          Reset Filter
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Email</th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Audience</th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Description</th>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-600">Enabled</th>
              <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-slate-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredTemplates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                  Tidak ada template yang cocok.
                </td>
              </tr>
            ) : (
              filteredTemplates.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.audience === "admin"
                          ? "bg-violet-100 text-violet-700"
                          : item.audience === "member"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {item.audience}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{item.description}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.enabled}
                      onClick={() => updateTemplate(item.id, { enabled: !item.enabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        item.enabled ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          item.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openTestModal(item)}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Test
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedID(item.id)}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Manage
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminModal
        open={Boolean(selected)}
        onClose={() => setSelectedID("")}
        title={selected ? `Manage (${locale.toUpperCase()}): ${selected.name}` : "Manage Notification"}
        maxWidth="xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSelectedID("")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveTemplates}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        {!selected ? null : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs uppercase text-slate-500">Recipients</p>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={selected.recipients}
                  onChange={(e) => updateTemplate(selected.id, { recipients: e.target.value })}
                  placeholder="admin@domain.com"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase text-slate-500">Status</p>
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {selected.enabled ? "Enabled" : "Disabled"}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase text-slate-500">Email Subject</p>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={selected.subject}
                onChange={(e) => updateTemplate(selected.id, { subject: e.target.value })}
                placeholder="Subject email"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase text-slate-500">Email Body</p>
              <textarea
                className="min-h-[180px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={selected.body}
                onChange={(e) => updateTemplate(selected.id, { body: e.target.value })}
                placeholder="Body template"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium uppercase text-slate-500">Available Placeholders</p>
              <div className="flex flex-wrap gap-2">
                {placeholders.map((token) => (
                  <span key={token} className="rounded bg-white px-2 py-1 text-xs text-slate-700 border border-slate-200">
                    {token}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </AdminModal>

      <AdminModal
        open={Boolean(testTemplate)}
        onClose={closeTestModal}
        title={testTemplate ? `Test: ${testTemplate.name}` : "Test Notification"}
        maxWidth="lg"
        footer={
          <>
            <button
              type="button"
              onClick={closeTestModal}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSendTest}
              disabled={testLoading || !testTemplate}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {testLoading ? "Sending..." : "Send Test"}
            </button>
          </>
        }
      >
        {!testTemplate ? null : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold uppercase text-slate-500">Recipient</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="you@example.com"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block text-xs font-semibold uppercase text-slate-500">Locale</span>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={testLocale}
                  onChange={(e) => setTestLocale(e.target.value as Locale)}
                >
                  {LOCALES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-1 text-sm">
              <span className="block text-xs font-semibold uppercase text-slate-500">Template Variables (JSON)</span>
              <textarea
                className="h-[180px] w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                spellCheck={false}
                value={testVarsInput}
                onChange={(e) => setTestVarsInput(e.target.value)}
              />
              <p className="text-xs text-slate-500">Use placeholders: {placeholders.join(", ")}</p>
            </label>

            {testPreview ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Preview</p>
                <div>
                  <p className="text-xs font-semibold text-slate-600">Subject</p>
                  <div className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                    {testPreview.subject}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600">Body</p>
                  <pre className="overflow-x-auto rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                    {testPreview.body}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600">HTML Preview</p>
                  <div className="overflow-hidden rounded border border-slate-200 bg-white px-3 py-2">
                    <div
                      className="prose max-w-none text-slate-800"
                      dangerouslySetInnerHTML={{ __html: testPreview.html_body }}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Sent to {testPreview.sent_to} at {testPreview.timestamp ? new Date(testPreview.timestamp).toLocaleString() : "unknown"}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </AdminModal>
    </div>
  );
}
