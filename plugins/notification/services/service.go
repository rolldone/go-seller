package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"os"
	"strconv"
	"strings"
	txttpl "text/template"
	"time"

	"go_framework/internal/uuid"
	authmodels "go_framework/plugins/auth/models"
	"go_framework/plugins/notification/mail"
	ordermodels "go_framework/plugins/order/models"
	settingmodels "go_framework/plugins/setting/models"

	"gorm.io/gorm"
)

// Service is the notification service used by the notification plugin.
type Service struct {
	DB *gorm.DB
}

func New(db *gorm.DB) *Service { return &Service{DB: db} }

type SeedEntry struct {
	Key         string          `json:"key"`
	Scope       string          `json:"scope"`
	Value       json.RawMessage `json:"value"`
	Description *string         `json:"description"`
}

type TemplateConfig struct {
	Name        string `json:"name"`
	Audience    string `json:"audience"`
	Enabled     bool   `json:"enabled"`
	Recipients  string `json:"recipients"`
	Subject     string `json:"subject"`
	Body        string `json:"body"`
	Description string `json:"description,omitempty"`
}

var notificationTemplateAliases = map[string]string{
	"team_member_invited_member":   "team_member_invited_admin",
	"team_member_invited_admin":    "team_member_invited_member",
	"team_member_suspended_member": "team_member_suspended_admin",
	"team_member_suspended_admin":  "team_member_suspended_member",
	"new_order_admin":              "order_created",
	"new_order_member":             "order_created_member",
	"processing_order_customer":    "payment_succeeded",
	"order_paid_member":            "payment_succeeded_member",
	"failed_order_admin":           "payment_failed",
	"order_payment_failed_member":  "payment_failed_member",
}

func templateEventKeyCandidates(eventKey string) []string {
	trimmed := strings.TrimSpace(eventKey)
	if trimmed == "" {
		return nil
	}
	candidates := []string{trimmed}
	if alias, ok := notificationTemplateAliases[trimmed]; ok {
		alias = strings.TrimSpace(alias)
		if alias != "" && alias != trimmed {
			candidates = append(candidates, alias)
		}
	}
	return candidates
}

type inlineMail struct {
	subject  string
	htmlBody string
	textBody string
	fromMail string
	fromName string
}

func (m *inlineMail) Subject() string              { return m.subject }
func (m *inlineMail) TemplateBase() string         { return "" }
func (m *inlineMail) Data() map[string]interface{} { return map[string]interface{}{} }
func (m *inlineMail) From() (string, string)       { return m.fromMail, m.fromName }
func (m *inlineMail) HTMLBody() string             { return m.htmlBody }
func (m *inlineMail) TextBody() string             { return m.textBody }

var defaultTemplates = map[string]TemplateConfig{
	"new_order_admin": {
		Name:       "New Order",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, owner@goseller.local",
		Subject:    "[Order Baru] {{.order_number}} - {{.business_name}}",
		Body:       "Halo Admin, order baru {{.order_number}} dengan total {{.currency}} {{.grand_total}} baru saja dibuat.",
	},
	"order_created": {
		Name:       "Order Created",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, owner@goseller.local",
		Subject:    "[Order Baru] {{.order_number}} - {{.business_name}}",
		Body:       "Halo Admin, order baru {{.order_number}} dengan total {{.currency}} {{.grand_total}} baru saja dibuat.",
	},
	"order_created_member": {
		Name:       "Order Created Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Order Baru] {{.order_number}} - {{.business_name}}",
		Body:       "Halo {{.seller_name}}, order baru {{.order_number}} dengan total {{.currency}} {{.grand_total}} baru saja dibuat.",
	},
	"cancelled_order_admin": {
		Name:       "Cancelled Order",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local",
		Subject:    "[Order Dibatalkan] {{.order_number}}",
		Body:       "Order {{.order_number}} dibatalkan. Status order saat ini: {{.order_status}}.",
	},
	"failed_order_admin": {
		Name:       "Failed Order",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "finance@goseller.local",
		Subject:    "[Payment Gagal] {{.order_number}}",
		Body:       "Payment untuk order {{.order_number}} gagal atau ditolak. Status payment: {{.payment_status}}.",
	},
	"payment_failed": {
		Name:       "Payment Failed",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "finance@goseller.local",
		Subject:    "[Payment Gagal] {{.order_number}}",
		Body:       "Payment untuk order {{.order_number}} gagal atau ditolak. Status payment: {{.payment_status}}.",
	},
	"payment_failed_member": {
		Name:       "Payment Failed Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Payment Gagal] {{.order_number}}",
		Body:       "Halo {{.seller_name}}, payment untuk order {{.order_number}} gagal atau ditolak. Status payment: {{.payment_status}}.",
	},
	"processing_order_customer": {
		Name:       "Processing Order",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Order kamu sedang diproses - {{.order_number}}",
		Body:       "Hi {{.customer_name}}, order {{.order_number}} sudah kami terima dan pembayaran sudah terverifikasi.",
	},
	"payment_succeeded": {
		Name:       "Payment Succeeded",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Pembayaran order {{.order_number}} berhasil",
		Body:       "Halo {{.customer_name}}, pembayaran untuk order {{.order_number}} berhasil diterima. Status saat ini: {{.payment_status}}.",
	},
	"payment_succeeded_member": {
		Name:       "Payment Succeeded Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "Pembayaran order {{.order_number}} berhasil",
		Body:       "Halo {{.seller_name}}, pembayaran untuk order {{.order_number}} berhasil diterima. Status saat ini: {{.payment_status}}.",
	},
	"customer_confirmation_requested": {
		Name:       "Customer Confirmation Requested",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Konfirmasi penerimaan order {{.order_number}}",
		Body:       "Halo {{.customer_name}}, seller meminta konfirmasi bahwa order {{.order_number}} sudah sampai. Silakan cek detail order dan pilih terima atau tolak.{{if .confirmation_message}}\n\nPesan seller: {{.confirmation_message}}{{end}}",
	},
	"order_dispute_opened_admin": {
		Name:       "Order Dispute Opened Admin",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local",
		Subject:    "[Dispute Order] {{.order_number}} butuh review admin",
		Body:       "Order {{.order_number}} masuk dispute dan menunggu review admin.\n\nCustomer: {{.customer_name}}\nAlasan customer: {{.dispute_customer_reason}}{{if .dispute_confirmation_reject_reason}}\nAlasan tolak konfirmasi: {{.dispute_confirmation_reject_reason}}{{end}}{{if .dispute_seller_note}}\nCatatan seller: {{.dispute_seller_note}}{{end}}",
	},
	"order_dispute_opened_member": {
		Name:       "Order Dispute Opened Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Dispute Order] {{.order_number}} dibuka customer",
		Body:       "Halo, order {{.order_number}} masuk dispute.\n\nCustomer: {{.customer_name}}\nAlasan customer: {{.dispute_customer_reason}}{{if .dispute_confirmation_reject_reason}}\nAlasan tolak konfirmasi: {{.dispute_confirmation_reject_reason}}{{end}}{{if .dispute_seller_note}}\nCatatan seller saat ini: {{.dispute_seller_note}}{{end}}\n\nSilakan cek detail order dan lengkapi catatan dispute bila perlu.",
	},
	"complaint_reminder_customer": {
		Name:       "Complaint Reminder Customer",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.recipient_emails}}",
		Subject:    "[Reminder Complaint] {{.order_number}} menunggu respon",
		Body:       "Halo {{.recipient_name}}, ada pesan di complaint order {{.order_number}} yang belum dibaca.\n\nSubject: {{.complaint_subject}}\n\nSilakan buka complaint list untuk melanjutkan diskusi.{{if .complaint_link}}\n\nLink: {{.complaint_link}}{{end}}",
	},
	"complaint_reminder_business": {
		Name:       "Complaint Reminder Business",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.recipient_emails}}",
		Subject:    "[Reminder Complaint] {{.order_number}} menunggu respon seller",
		Body:       "Halo {{.recipient_name}}, complaint order {{.order_number}} masih menunggu respon.\n\nSubject: {{.complaint_subject}}\n\nSilakan cek complaint list dan tanggapi pesan terbaru.{{if .complaint_link}}\n\nLink: {{.complaint_link}}{{end}}",
	},
	"order_dispute_seller_won_customer": {
		Name:       "Order Dispute Seller Won Customer",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Hasil dispute order {{.order_number}}",
		Body:       "Halo {{.customer_name}}, dispute untuk order {{.order_number}} telah diputuskan untuk seller. Order dinyatakan selesai.{{if .dispute_admin_note}}\n\nCatatan admin: {{.dispute_admin_note}}{{end}}",
	},
	"order_dispute_seller_won_member": {
		Name:       "Order Dispute Seller Won Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Dispute Order] {{.order_number}} dimenangkan seller",
		Body:       "Halo, admin telah memutuskan dispute order {{.order_number}} untuk seller. Order dinyatakan selesai.{{if .dispute_admin_note}}\n\nCatatan admin: {{.dispute_admin_note}}{{end}}",
	},
	"order_dispute_customer_won_customer": {
		Name:       "Order Dispute Customer Won Customer",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Refund diproses untuk dispute order {{.order_number}}",
		Body:       "Halo {{.customer_name}}, dispute untuk order {{.order_number}} diputuskan untuk customer. Refund sedang diproses manual oleh admin.{{if .dispute_admin_note}}\n\nCatatan admin: {{.dispute_admin_note}}{{end}}",
	},
	"order_dispute_customer_won_member": {
		Name:       "Order Dispute Customer Won Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Dispute Order] {{.order_number}} diputuskan untuk customer",
		Body:       "Halo, admin telah memutuskan dispute order {{.order_number}} untuk customer. Refund akan diproses manual.{{if .dispute_admin_note}}\n\nCatatan admin: {{.dispute_admin_note}}{{end}}",
	},
	"order_dispute_refunded_customer": {
		Name:       "Order Dispute Refunded Customer",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Refund dispute order {{.order_number}} selesai",
		Body:       "Halo {{.customer_name}}, refund untuk dispute order {{.order_number}} telah diselesaikan admin.{{if .dispute_refund_note}}\n\nCatatan refund: {{.dispute_refund_note}}{{end}}",
	},
	"order_dispute_refunded_member": {
		Name:       "Order Dispute Refunded Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Dispute Order] Refund {{.order_number}} selesai",
		Body:       "Halo, refund untuk dispute order {{.order_number}} telah ditandai selesai oleh admin.{{if .dispute_refund_note}}\n\nCatatan refund: {{.dispute_refund_note}}{{end}}",
	},
	"completed_order_customer": {
		Name:       "Completed Order",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Order selesai - {{.order_number}}",
		Body:       "Hi {{.customer_name}}, order {{.order_number}} sudah selesai. Terima kasih sudah belanja.",
	},
	"delivery_status_changed_customer": {
		Name:       "Delivery Status Changed",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "[Delivery] {{.order_number}} berubah ke {{.delivery_status}}",
		Body:       "Halo {{.customer_name}}, status delivery order {{.order_number}} berubah dari {{.previous_delivery_status}} ke {{.delivery_status}}.{{if .carrier_name}}\n\nKurir: {{.carrier_name}}{{end}}{{if .service_name}}\nLayanan: {{.service_name}}{{end}}{{if .tracking_number}}\nResi: {{.tracking_number}}{{end}}{{if .estimated_delivery}}\nEstimasi: {{.estimated_delivery}}{{end}}",
	},
	"customer_forgot_password": {
		Name:       "Customer Forgot Password",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Reset password akun GoSeller",
		Body:       "Halo {{.customer_name}}, kami menerima permintaan reset password. Klik tautan berikut untuk melanjutkan: {{.reset_url}}. Tautan ini berlaku 15 menit.",
	},
	"member_forgot_password": {
		Name:       "Member Forgot Password",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.member_email}}",
		Subject:    "Reset password akun member GoSeller",
		Body:       "Halo {{.member_name}}, kami menerima permintaan reset password untuk akun member kamu. Klik tautan berikut untuk melanjutkan: {{.reset_url}}. Tautan ini berlaku 15 menit.",
	},
	"proof_uploaded_admin": {
		Name:       "Proof Uploaded",
		Audience:   "admin",
		Enabled:    false,
		Recipients: "admin@goseller.local",
		Subject:    "[Bukti Transfer Baru] {{.order_number}}",
		Body:       "Bukti transfer baru sudah diupload untuk order {{.order_number}}. Silakan cek panel admin.",
	},
	"member_setup_admin": {
		Name:       "Member Setup Admin",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local",
		Subject:    "[Member Baru] {{.full_name}} - {{.business_name}}",
		Body:       "Member baru berhasil dibuat. Nama: {{.full_name}} | Email: {{.member_email}} | Business: {{.business_name}} ({{.business_slug}}) | Status: {{.setup_status}}. Menunggu verifikasi email.",
	},
	"member_setup_member": {
		Name:       "Member Setup Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.member_email}}",
		Subject:    "Verifikasi email akun member - {{.business_name}}",
		Body:       "Member baru berhasil dibuat. Nama: {{.full_name}} | Email: {{.member_email}} | Business: {{.business_name}} ({{.business_slug}}) | Status: {{.setup_status}}. Menunggu verifikasi email.",
	},
	"member_setup_failed_admin": {
		Name:       "Member Setup Failed",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local",
		Subject:    "Verifikasi email akun member - {{.business_name}}",
		Body:       "Halo {{.full_name}}, akun member kamu sudah dibuat untuk business {{.business_name}}. Silakan verifikasi email lewat {{.activation_url}}. Setelah itu login via {{.login_url}} menggunakan email dan password yang kamu buat saat setup.",
	},
	"team_member_invited_member": {
		Name:       "Team Member Invited",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.member_email}}",
		Subject:    "[Team Invite] {{.business_name}}",
		Body:       "Hi {{.member_name}}, you have been invited by {{.invited_by_label}} {{.invited_by_name}} to join {{.business_name}} as {{.role}}. Click here to accept the invitation: {{.invite_url}}.",
	},
	"team_member_suspended_member": {
		Name:       "Team Member Suspended",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.member_email}}",
		Subject:    "[Access Suspended] {{.business_name}}",
		Body:       "Hi {{.member_name}}, your team access for {{.business_name}} has been suspended. Reason: {{.reason}}. If you think this is a mistake, please contact the inviter.",
	},
	"withdrawal_requested_member": {
		Name:       "Permintaan Penarikan Dana",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Penarikan Dana] Permintaan #{{.withdrawal_id}} sedang diproses",
		Body:       "Halo {{.seller_name}},\n\nPermintaan penarikan dana kamu telah diterima.\n\nID Penarikan: #{{.withdrawal_id}}\nJumlah: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nPermintaan kamu sedang menunggu review admin.",
	},
	"withdrawal_requested_admin": {
		Name:       "Permintaan Penarikan Baru (Admin)",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, finance@goseller.local",
		Subject:    "[Penarikan Dana] Permintaan baru dari {{.seller_name}}",
		Body:       "Ada permintaan penarikan dana baru.\n\nID: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nJumlah: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})",
	},
	"withdrawal_approved_admin": {
		Name:       "Penarikan Dana Disetujui (Admin)",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, finance@goseller.local",
		Subject:    "[Penarikan Dana] Permintaan #{{.withdrawal_id}} disetujui",
		Body:       "Permintaan penarikan dana telah disetujui.\n\nID Penarikan: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nJumlah: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nSilakan lanjutkan proses transfer.",
	},
	"withdrawal_rejected_admin": {
		Name:       "Penarikan Dana Ditolak (Admin)",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, finance@goseller.local",
		Subject:    "[Penarikan Dana] Permintaan #{{.withdrawal_id}} ditolak",
		Body:       "Permintaan penarikan dana telah ditolak.\n\nID Penarikan: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nJumlah: {{.amount}}\nAlasan: {{.admin_notes}}\n\nSaldo telah dikembalikan ke akun seller.",
	},
	"withdrawal_processed_admin": {
		Name:       "Penarikan Dana Diproses (Admin)",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, finance@goseller.local",
		Subject:    "[Penarikan Dana] Permintaan #{{.withdrawal_id}} telah diproses",
		Body:       "Permintaan penarikan dana telah diproses dan ditransfer.\n\nID Penarikan: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nJumlah: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})",
	},
	"withdrawal_approved_member": {
		Name:       "Penarikan Dana Disetujui",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Penarikan Dana] Permintaan #{{.withdrawal_id}} disetujui",
		Body:       "Halo {{.seller_name}},\n\nPermintaan penarikan dana kamu telah disetujui. Dana akan segera ditransfer ke rekening kamu.\n\nID: #{{.withdrawal_id}}\nJumlah: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})",
	},
	"withdrawal_rejected_member": {
		Name:       "Penarikan Dana Ditolak",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Penarikan Dana] Permintaan #{{.withdrawal_id}} ditolak",
		Body:       "Halo {{.seller_name}},\n\nPermintaan penarikan dana kamu ditolak.\n\nID: #{{.withdrawal_id}}\nJumlah: {{.amount}}\nAlasan: {{.admin_notes}}\n\nSaldo telah dikembalikan ke akun kamu.",
	},
	"withdrawal_processed_member": {
		Name:       "Penarikan Dana Diproses",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Penarikan Dana] Permintaan #{{.withdrawal_id}} telah diproses",
		Body:       "Halo {{.seller_name}},\n\nDana penarikan kamu telah ditransfer.\n\nID: #{{.withdrawal_id}}\nJumlah: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nSilakan periksa rekening kamu dalam 1-3 hari kerja.",
	},
}

var defaultTemplatesEN = map[string]TemplateConfig{
	"new_order_admin": {
		Name:       "New Order",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, owner@goseller.local",
		Subject:    "[New Order] {{.order_number}} - {{.business_name}}",
		Body:       "Hello Admin, new order {{.order_number}} with total {{.currency}} {{.grand_total}} has just been created.",
	},
	"order_created": {
		Name:       "Order Created",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, owner@goseller.local",
		Subject:    "[New Order] {{.order_number}} - {{.business_name}}",
		Body:       "Hello Admin, new order {{.order_number}} with total {{.currency}} {{.grand_total}} has just been created.",
	},
	"order_created_member": {
		Name:       "Order Created Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[New Order] {{.order_number}} - {{.business_name}}",
		Body:       "Hello {{.seller_name}}, new order {{.order_number}} with total {{.currency}} {{.grand_total}} has just been created.",
	},
	"cancelled_order_admin": {
		Name:       "Cancelled Order",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local",
		Subject:    "[Order Cancelled] {{.order_number}}",
		Body:       "Order {{.order_number}} has been cancelled. Current order status: {{.order_status}}.",
	},
	"failed_order_admin": {
		Name:       "Failed Order",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "finance@goseller.local",
		Subject:    "[Payment Failed] {{.order_number}}",
		Body:       "Payment for order {{.order_number}} failed or was rejected. Payment status: {{.payment_status}}.",
	},
	"payment_failed": {
		Name:       "Payment Failed",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "finance@goseller.local",
		Subject:    "[Payment Failed] {{.order_number}}",
		Body:       "Payment for order {{.order_number}} failed or was rejected. Payment status: {{.payment_status}}.",
	},
	"payment_failed_member": {
		Name:       "Payment Failed Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Payment Failed] {{.order_number}}",
		Body:       "Hello {{.seller_name}}, payment for order {{.order_number}} failed or was rejected. Payment status: {{.payment_status}}.",
	},
	"processing_order_customer": {
		Name:       "Processing Order",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Your order is being processed - {{.order_number}}",
		Body:       "Hi {{.customer_name}}, your order {{.order_number}} has been received and your payment has been verified.",
	},
	"payment_succeeded": {
		Name:       "Payment Succeeded",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Payment successful - {{.order_number}}",
		Body:       "Hi {{.customer_name}}, payment for order {{.order_number}} was successful. Current status: {{.payment_status}}.",
	},
	"payment_succeeded_member": {
		Name:       "Payment Succeeded Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "Payment successful - {{.order_number}}",
		Body:       "Hello {{.seller_name}}, payment for order {{.order_number}} was successful. Current status: {{.payment_status}}.",
	},
	"customer_confirmation_requested": {
		Name:       "Customer Confirmation Requested",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Confirm delivery for order {{.order_number}}",
		Body:       "Hi {{.customer_name}}, the seller asked you to confirm that order {{.order_number}} has arrived. Please open the order detail and choose accept or reject.{{if .confirmation_message}}\n\nSeller message: {{.confirmation_message}}{{end}}",
	},
	"order_dispute_opened_admin": {
		Name:       "Order Dispute Opened Admin",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local",
		Subject:    "[Order Dispute] {{.order_number}} needs admin review",
		Body:       "Order {{.order_number}} is now in dispute and needs admin review.\n\nCustomer: {{.customer_name}}\nCustomer reason: {{.dispute_customer_reason}}{{if .dispute_confirmation_reject_reason}}\nConfirmation rejection reason: {{.dispute_confirmation_reject_reason}}{{end}}{{if .dispute_seller_note}}\nSeller note: {{.dispute_seller_note}}{{end}}",
	},
	"order_dispute_opened_member": {
		Name:       "Order Dispute Opened Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Order Dispute] {{.order_number}} opened by customer",
		Body:       "Hello, order {{.order_number}} is now in dispute.\n\nCustomer: {{.customer_name}}\nCustomer reason: {{.dispute_customer_reason}}{{if .dispute_confirmation_reject_reason}}\nConfirmation rejection reason: {{.dispute_confirmation_reject_reason}}{{end}}{{if .dispute_seller_note}}\nCurrent seller note: {{.dispute_seller_note}}{{end}}\n\nPlease review the order detail and add a dispute note if needed.",
	},
	"complaint_reminder_customer": {
		Name:       "Complaint Reminder Customer",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.recipient_emails}}",
		Subject:    "[Complaint Reminder] {{.order_number}} is waiting for a response",
		Body:       "Hello {{.recipient_name}}, there is a complaint on order {{.order_number}} that has not been read yet.\n\nSubject: {{.complaint_subject}}\n\nPlease open the complaint list and continue the discussion.{{if .complaint_link}}\n\nLink: {{.complaint_link}}{{end}}",
	},
	"complaint_reminder_business": {
		Name:       "Complaint Reminder Business",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.recipient_emails}}",
		Subject:    "[Complaint Reminder] {{.order_number}} is waiting for seller response",
		Body:       "Hello {{.recipient_name}}, complaint for order {{.order_number}} is still waiting for a response.\n\nSubject: {{.complaint_subject}}\n\nPlease check the complaint list and reply to the latest message.{{if .complaint_link}}\n\nLink: {{.complaint_link}}{{end}}",
	},
	"order_dispute_seller_won_customer": {
		Name:       "Order Dispute Seller Won Customer",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Dispute result for order {{.order_number}}",
		Body:       "Hi {{.customer_name}}, the dispute for order {{.order_number}} has been resolved in favor of the seller. The order is now completed.{{if .dispute_admin_note}}\n\nAdmin note: {{.dispute_admin_note}}{{end}}",
	},
	"order_dispute_seller_won_member": {
		Name:       "Order Dispute Seller Won Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Order Dispute] {{.order_number}} resolved for seller",
		Body:       "Hello, admin resolved the dispute for order {{.order_number}} in favor of the seller. The order is now completed.{{if .dispute_admin_note}}\n\nAdmin note: {{.dispute_admin_note}}{{end}}",
	},
	"order_dispute_customer_won_customer": {
		Name:       "Order Dispute Customer Won Customer",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Refund is being prepared for order {{.order_number}}",
		Body:       "Hi {{.customer_name}}, the dispute for order {{.order_number}} has been resolved in favor of the customer. The refund is being processed manually by admin.{{if .dispute_admin_note}}\n\nAdmin note: {{.dispute_admin_note}}{{end}}",
	},
	"order_dispute_customer_won_member": {
		Name:       "Order Dispute Customer Won Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Order Dispute] {{.order_number}} resolved for customer",
		Body:       "Hello, admin resolved the dispute for order {{.order_number}} in favor of the customer. The refund will be handled manually.{{if .dispute_admin_note}}\n\nAdmin note: {{.dispute_admin_note}}{{end}}",
	},
	"order_dispute_refunded_customer": {
		Name:       "Order Dispute Refunded Customer",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Refund completed for order {{.order_number}}",
		Body:       "Hi {{.customer_name}}, the refund for disputed order {{.order_number}} has been completed by admin.{{if .dispute_refund_note}}\n\nRefund note: {{.dispute_refund_note}}{{end}}",
	},
	"order_dispute_refunded_member": {
		Name:       "Order Dispute Refunded Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Order Dispute] Refund completed for {{.order_number}}",
		Body:       "Hello, the refund for disputed order {{.order_number}} has been marked completed by admin.{{if .dispute_refund_note}}\n\nRefund note: {{.dispute_refund_note}}{{end}}",
	},
	"completed_order_customer": {
		Name:       "Completed Order",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Order completed - {{.order_number}}",
		Body:       "Hi {{.customer_name}}, your order {{.order_number}} is completed. Thank you for shopping with us.",
	},
	"delivery_status_changed_customer": {
		Name:       "Delivery Status Changed",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "[Delivery] {{.order_number}} changed to {{.delivery_status}}",
		Body:       "Hi {{.customer_name}}, the delivery status for order {{.order_number}} changed from {{.previous_delivery_status}} to {{.delivery_status}}.{{if .carrier_name}}\n\nCarrier: {{.carrier_name}}{{end}}{{if .service_name}}\nService: {{.service_name}}{{end}}{{if .tracking_number}}\nTracking Number: {{.tracking_number}}{{end}}{{if .estimated_delivery}}\nEstimated Delivery: {{.estimated_delivery}}{{end}}",
	},
	"customer_forgot_password": {
		Name:       "Customer Forgot Password",
		Audience:   "customer",
		Enabled:    true,
		Recipients: "{{.customer_email}}",
		Subject:    "Reset GoSeller account password",
		Body:       "Hi {{.customer_name}}, we received a password reset request for your account. Click this link to continue: {{.reset_url}}. This link is valid for 15 minutes.",
	},
	"member_forgot_password": {
		Name:       "Member Forgot Password",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.member_email}}",
		Subject:    "Reset GoSeller member account password",
		Body:       "Hi {{.member_name}}, we received a password reset request for your member account. Click this link to continue: {{.reset_url}}. This link is valid for 15 minutes.",
	},
	"proof_uploaded_admin": {
		Name:       "Proof Uploaded",
		Audience:   "admin",
		Enabled:    false,
		Recipients: "admin@goseller.local",
		Subject:    "[New Transfer Proof] {{.order_number}}",
		Body:       "A new transfer proof has been uploaded for order {{.order_number}}. Please check the admin panel.",
	},
	"member_setup_admin": {
		Name:       "Member Setup Admin",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local",
		Subject:    "[New Member] {{.full_name}} - {{.business_name}}",
		Body:       "A new member has been created. Name: {{.full_name}} | Email: {{.member_email}} | Business: {{.business_name}} ({{.business_slug}}) | Status: {{.setup_status}}. Waiting for email verification.",
	},
	"member_setup_member": {
		Name:       "Member Setup Member",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.member_email}}",
		Subject:    "Verify your member email - {{.business_name}}",
		Body:       "Hello {{.full_name}}, your member account for {{.business_name}} is ready. Please verify your email via {{.activation_url}}. After that, login via {{.login_url}} using the email and password you created during setup.",
	},
	"member_setup_failed_admin": {
		Name:       "Member Setup Failed",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local",
		Subject:    "Verify your member email - {{.business_name}}",
		Body:       "Hi {{.full_name}}, your member account for {{.business_name}} is ready. Please verify your email via {{.activation_url}}. After that, login via {{.login_url}} using the email and password you created during setup.",
	},
	"withdrawal_requested_member": {
		Name:       "Withdrawal Request",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Withdrawal] Request #{{.withdrawal_id}} is being processed",
		Body:       "Hi {{.seller_name}},\n\nYour withdrawal request has been received.\n\nWithdrawal ID: #{{.withdrawal_id}}\nAmount: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nYour request is pending admin review.",
	},
	"withdrawal_requested_admin": {
		Name:       "New Withdrawal Request (Admin)",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, finance@goseller.local",
		Subject:    "[Withdrawal] New request from {{.seller_name}}",
		Body:       "A new withdrawal request has been submitted.\n\nID: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nAmount: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})",
	},
	"withdrawal_approved_admin": {
		Name:       "Withdrawal Approved (Admin)",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, finance@goseller.local",
		Subject:    "[Withdrawal] Request #{{.withdrawal_id}} approved",
		Body:       "The withdrawal request has been approved.\n\nWithdrawal ID: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nAmount: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nPlease continue with the transfer process.",
	},
	"withdrawal_rejected_admin": {
		Name:       "Withdrawal Rejected (Admin)",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, finance@goseller.local",
		Subject:    "[Withdrawal] Request #{{.withdrawal_id}} rejected",
		Body:       "The withdrawal request has been rejected.\n\nWithdrawal ID: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nAmount: {{.amount}}\nReason: {{.admin_notes}}\n\nThe balance has been returned to the seller account.",
	},
	"withdrawal_processed_admin": {
		Name:       "Withdrawal Processed (Admin)",
		Audience:   "admin",
		Enabled:    true,
		Recipients: "admin@goseller.local, finance@goseller.local",
		Subject:    "[Withdrawal] Request #{{.withdrawal_id}} processed",
		Body:       "The withdrawal request has been processed and transferred.\n\nWithdrawal ID: #{{.withdrawal_id}}\nSeller: {{.seller_name}} ({{.seller_email}})\nAmount: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})",
	},
	"withdrawal_approved_member": {
		Name:       "Withdrawal Approved",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Withdrawal] Request #{{.withdrawal_id}} approved",
		Body:       "Hi {{.seller_name}},\n\nYour withdrawal request has been approved. Funds will be transferred to your bank account shortly.\n\nID: #{{.withdrawal_id}}\nAmount: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})",
	},
	"withdrawal_rejected_member": {
		Name:       "Withdrawal Rejected",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Withdrawal] Request #{{.withdrawal_id}} rejected",
		Body:       "Hi {{.seller_name}},\n\nWe're sorry, your withdrawal request has been rejected.\n\nID: #{{.withdrawal_id}}\nAmount: {{.amount}}\nReason: {{.admin_notes}}\n\nThe balance has been returned to your account.",
	},
	"withdrawal_processed_member": {
		Name:       "Withdrawal Processed",
		Audience:   "member",
		Enabled:    true,
		Recipients: "{{.seller_email}}",
		Subject:    "[Withdrawal] Request #{{.withdrawal_id}} has been processed",
		Body:       "Hi {{.seller_name}},\n\nYour withdrawal funds have been transferred.\n\nID: #{{.withdrawal_id}}\nAmount: {{.amount}}\nBank: {{.bank_name}} - {{.bank_account_number}} ({{.bank_account_name}})\n\nPlease check your bank account within 1-3 business days.",
	},
}

func NormalizeLocale(value string) string {
	locale := strings.ToLower(strings.TrimSpace(value))
	switch locale {
	case "id", "en":
		return locale
	default:
		return "id"
	}
}

func (s *Service) defaultTemplateFor(eventKey string, locale string) TemplateConfig {
	locale = NormalizeLocale(locale)
	for _, candidate := range templateEventKeyCandidates(eventKey) {
		if locale == "en" {
			if cfg, ok := defaultTemplatesEN[candidate]; ok {
				return cfg
			}
		}
		if cfg, ok := defaultTemplates[candidate]; ok {
			return cfg
		}
	}
	return TemplateConfig{}
}

func (s *Service) SendOrderEvent(ctx context.Context, db *gorm.DB, eventKey string, orderID string) error {
	orderID = strings.TrimSpace(orderID)
	if db == nil || orderID == "" {
		return nil
	}

	var order ordermodels.Order
	if err := db.WithContext(ctx).
		Preload("Customer").
		Preload("Payments").
		Preload("Shipments", func(db *gorm.DB) *gorm.DB { return db.Order("created_at DESC") }).
		Where("id = ?", orderID).
		First(&order).Error; err != nil {
		return err
	}

	return s.dispatch(ctx, db, eventKey, &order)
}

func (s *Service) SendOrderEventAsync(ctx context.Context, db *gorm.DB, eventKey string, orderID string) {
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = s.SendOrderEvent(bgCtx, db, eventKey, orderID)
	}()
}

// SendTemplateEvent dispatches a notification template using an arbitrary payload.
func (s *Service) SendTemplateEvent(ctx context.Context, db *gorm.DB, eventKey string, payload map[string]interface{}) error {
	if db == nil {
		return nil
	}
	return s.dispatchTemplate(ctx, db, eventKey, payload)
}

// SendTemplateEventAsync dispatches a notification template asynchronously.
func (s *Service) SendTemplateEventAsync(ctx context.Context, db *gorm.DB, eventKey string, payload map[string]interface{}) {
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = s.SendTemplateEvent(bgCtx, db, eventKey, payload)
	}()
}

func (s *Service) SendTestEmail(toEmail string, subject string, body string) error {
	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" {
		return errors.New("recipient email is required")
	}
	subject = strings.TrimSpace(subject)
	if subject == "" {
		subject = "Test Notification"
	}
	body = strings.TrimSpace(body)
	if body == "" {
		body = "Test email from Go Seller notification plugin sent at " + time.Now().Format(time.RFC3339)
	}
	htmlBody := s.wrapHTML(body)
	message := &inlineMail{subject: subject, htmlBody: htmlBody, textBody: body}
	return mail.NewMailer().Send(toEmail, message)
}

// LoadTemplateConfig returns the notification template config for a given event key and locale.
func (s *Service) LoadTemplateConfig(ctx context.Context, eventKey string, locale string) (TemplateConfig, error) {
	if s == nil || s.DB == nil {
		return TemplateConfig{}, errors.New("notification service is not initialized")
	}
	norm := NormalizeLocale(locale)
	return s.loadConfig(ctx, s.DB, eventKey, norm, s.getDefaultLocale(ctx, s.DB))
}

// BuildTestPayload returns placeholder data merged with overrides so tests can render templates.
func (s *Service) BuildTestPayload(overrides map[string]string) map[string]interface{} {
	if overrides == nil {
		overrides = map[string]string{}
	}
	payload := map[string]interface{}{
		"order_id":                           "test-order",
		"order_number":                       "TEST-1001",
		"order_status":                       "pending",
		"payment_status":                     "paid",
		"grand_total":                        "123.45",
		"currency":                           "IDR",
		"customer_name":                      "Test Customer",
		"customer_email":                     "test@example.com",
		"customer_locale":                    "id",
		"seller_name":                        "Test Seller",
		"seller_email":                       "seller@example.com",
		"business_name":                      "Go Seller",
		"delivery_status":                    "ready_to_ship",
		"previous_delivery_status":           "pending",
		"shipment_status":                    "ready_to_ship",
		"carrier_name":                       "JNE",
		"service_name":                       "REG",
		"tracking_number":                    "TEST-TRACKING-001",
		"estimated_delivery":                 "2-3 hari kerja",
		"shipment_count":                     1,
		"dispute_customer_reason":            "barang rusak saat diterima",
		"dispute_seller_note":                "seller sudah lampirkan bukti kirim",
		"dispute_admin_decision":             "open",
		"dispute_admin_note":                 "menunggu verifikasi tambahan",
		"dispute_refund_note":                "refund diproses manual",
		"dispute_confirmation_reject_reason": "paket belum sesuai",
		"member_name":                        "Test Member",
		"role":                               "Editor",
		"invited_by_label":                   "Owner",
		"invited_by_name":                    "Owner Name",
		"invited_by_email":                   "owner@example.com",
		"invite_url":                         "https://example.com/member/auth/team-invite?token=TEST-INVITE-TOKEN",
		"reason":                             "access suspended for review",
		"order_link":                         "/admin/orders",
		"reset_token":                        "TEST-RESET-TOKEN",
		"reset_url":                          "https://example.com/customer/auth/reset-password?token=TEST-RESET-TOKEN",
		"app_name":                           "Go Seller",
	}
	for key, value := range overrides {
		if strings.TrimSpace(key) == "" {
			continue
		}
		payload[key] = value
	}
	return payload
}

func (s *Service) wrapHTML(body string) string {
	trimmed := strings.TrimSpace(body)
	escaped := html.EscapeString(trimmed)
	formatted := strings.ReplaceAll(escaped, "\n", "<br/>")
	return fmt.Sprintf("<html><body><div style=\"font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;\">%s</div></body></html>", formatted)
}

// RenderTemplate exposes the internal template renderer for other packages.
func (s *Service) RenderTemplate(input string, data map[string]interface{}) (string, error) {
	return s.renderTemplate(input, data)
}

// FormatHTML wraps a plain-text body with the HTML wrapper used by the mailer.
func (s *Service) FormatHTML(body string) string {
	return s.wrapHTML(body)
}

// SendInlineEmail sends the provided subject/body to the given recipient using the internal mailer.
func (s *Service) SendInlineEmail(toEmail string, subject string, body string) error {
	if strings.TrimSpace(toEmail) == "" {
		return errors.New("recipient email is required")
	}
	message := &inlineMail{subject: subject, htmlBody: s.wrapHTML(body), textBody: body}
	return mail.NewMailer().Send(toEmail, message)
}

func (s *Service) SeedDefaults(path string) error {
	if s == nil || s.DB == nil {
		return errors.New("notification: service database is not configured")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var entries []SeedEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return err
	}
	now := time.Now()
	for _, entry := range entries {
		var existing settingmodels.Setting
		err := s.DB.Where("scope = ? AND key = ?", entry.Scope, entry.Key).First(&existing).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		item := settingmodels.Setting{
			ID:          uuid.NewString(),
			Scope:       entry.Scope,
			Key:         entry.Key,
			Value:       []byte(entry.Value),
			Description: entry.Description,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if err := s.DB.Create(&item).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) dispatch(ctx context.Context, db *gorm.DB, eventKey string, order *ordermodels.Order) error {
	payload := s.buildPayload(ctx, db, order)
	return s.dispatchTemplate(ctx, db, eventKey, payload)
}

func (s *Service) dispatchTemplate(ctx context.Context, db *gorm.DB, eventKey string, payload map[string]interface{}) error {
	if payload == nil {
		payload = map[string]interface{}{}
	}
	customerLocale, _ := payload["customer_locale"].(string)
	defaultLocale := s.getDefaultLocale(ctx, db)
	config := s.defaultTemplateFor(eventKey, customerLocale)
	if stored, err := s.loadConfig(ctx, db, eventKey, customerLocale, defaultLocale); err == nil {
		config = stored
	}
	if !config.Enabled {
		return nil
	}

	subject, err := s.renderTemplate(config.Subject, payload)
	if err != nil {
		return err
	}
	body, err := s.renderTemplate(config.Body, payload)
	if err != nil {
		return err
	}
	recipientsRaw, err := s.renderTemplate(config.Recipients, payload)
	if err != nil {
		return err
	}
	recipients := s.splitRecipients(recipientsRaw)
	if len(recipients) == 0 {
		return nil
	}

	htmlBody := "<html><body><div style=\"font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;\">" + strings.ReplaceAll(html.EscapeString(body), "\n", "<br/>") + "</div></body></html>"
	mailer := mail.NewMailer()
	message := &inlineMail{subject: subject, htmlBody: htmlBody, textBody: body}
	for _, recipient := range recipients {
		mailer.Queue(recipient, message)
	}
	return nil
}

func (s *Service) loadConfig(ctx context.Context, db *gorm.DB, eventKey string, customerLocale string, defaultLocale string) (TemplateConfig, error) {
	customerLocale = NormalizeLocale(customerLocale)
	defaultLocale = NormalizeLocale(defaultLocale)
	keys := make([]string, 0, 6)
	for _, candidate := range templateEventKeyCandidates(eventKey) {
		keys = append(keys, "notifications."+strings.TrimSpace(candidate)+"."+customerLocale)
		if defaultLocale != customerLocale {
			keys = append(keys, "notifications."+strings.TrimSpace(candidate)+"."+defaultLocale)
		}
		keys = append(keys, "notifications."+strings.TrimSpace(candidate))
	}

	var lastErr error
	for _, key := range keys {
		cfg, err := s.loadConfigByKey(ctx, db, key, eventKey, customerLocale)
		if err == nil {
			return cfg, nil
		}
		lastErr = err
	}
	if lastErr == nil {
		lastErr = errors.New("notification config not found")
	}
	return TemplateConfig{}, lastErr
}

func (s *Service) loadConfigByKey(ctx context.Context, db *gorm.DB, key string, eventKey string, locale string) (TemplateConfig, error) {
	var item settingmodels.Setting
	if err := db.WithContext(ctx).Where("scope = ? AND key = ?", "global", key).First(&item).Error; err != nil {
		return TemplateConfig{}, err
	}
	var cfg TemplateConfig
	if err := json.Unmarshal(item.Value, &cfg); err != nil {
		return TemplateConfig{}, err
	}
	fallback := s.defaultTemplateFor(eventKey, locale)
	if cfg.Subject == "" || cfg.Body == "" || cfg.Recipients == "" {
		if cfg.Subject == "" {
			cfg.Subject = fallback.Subject
		}
		if cfg.Body == "" {
			cfg.Body = fallback.Body
		}
		if cfg.Recipients == "" {
			cfg.Recipients = fallback.Recipients
		}
	}
	if cfg.Name == "" {
		cfg.Name = fallback.Name
	}
	if cfg.Audience == "" {
		cfg.Audience = fallback.Audience
	}
	return cfg, nil
}

func (s *Service) getDefaultLocale(ctx context.Context, db *gorm.DB) string {
	var item settingmodels.Setting
	if err := db.WithContext(ctx).Where("scope = ? AND key = ?", "global", "i18n.default_locale").First(&item).Error; err != nil {
		return "id"
	}
	var locale string
	if err := json.Unmarshal(item.Value, &locale); err != nil {
		return "id"
	}
	return NormalizeLocale(locale)
}

func (s *Service) buildPayload(ctx context.Context, db *gorm.DB, order *ordermodels.Order) map[string]interface{} {
	var customerName string
	var customerEmail string
	customerLocale := "id"
	deliveryStatus := strings.TrimSpace(order.DeliveryStatus)
	if deliveryStatus == "" {
		deliveryStatus = "pending"
	}
	shipmentStatus := ""
	carrierName := ""
	serviceName := ""
	trackingNumber := ""
	estimatedDelivery := ""
	shipmentCount := 0
	confirmationStatus := ""
	confirmationMessage := ""
	confirmationRejectReason := ""
	disputeCustomerReason := ""
	disputeSellerNote := ""
	disputeAdminDecision := ""
	disputeAdminNote := ""
	disputeRefundNote := ""
	if order.Customer != nil {
		customerName = strings.TrimSpace(order.Customer.Name)
		customerEmail = strings.TrimSpace(order.Customer.Email)
		customerLocale = NormalizeLocale(order.Customer.Locale)
	} else if order.CustomerID != nil && strings.TrimSpace(*order.CustomerID) != "" {
		var customer authmodels.Customer
		if err := db.WithContext(ctx).Where("id = ?", *order.CustomerID).First(&customer).Error; err == nil {
			customerName = strings.TrimSpace(customer.Name)
			customerEmail = strings.TrimSpace(customer.Email)
			customerLocale = NormalizeLocale(customer.Locale)
		}
	}
	storeName := "Go Seller"
	var setting settingmodels.Setting
	if err := db.WithContext(ctx).Where("scope = ? AND key = ?", "global", "store.name").First(&setting).Error; err == nil {
		var name string
		if json.Unmarshal(setting.Value, &name) == nil && strings.TrimSpace(name) != "" {
			storeName = name
		}
	}
	paymentStatus := order.PaymentStatus
	if len(order.Payments) > 0 {
		paymentStatus = order.Payments[0].Status
	}
	if len(order.Shipments) > 0 {
		shipmentCount = len(order.Shipments)
		latestShipment := order.Shipments[0]
		shipmentStatus = strings.TrimSpace(latestShipment.Status)
		carrierName = strings.TrimSpace(latestShipment.CarrierName)
		serviceName = strings.TrimSpace(latestShipment.ServiceName)
		trackingNumber = strings.TrimSpace(latestShipment.TrackingNumber)
		estimatedDelivery = strings.TrimSpace(latestShipment.EstimatedDelivery)
	}
	if len(order.Metadata) > 0 && !strings.EqualFold(strings.TrimSpace(string(order.Metadata)), "null") {
		var metadata map[string]any
		if err := json.Unmarshal(order.Metadata, &metadata); err == nil {
			if rawConfirmation, ok := metadata["customer_confirmation"].(map[string]any); ok {
				if status, ok := rawConfirmation["status"].(string); ok {
					confirmationStatus = strings.TrimSpace(status)
				}
				if message, ok := rawConfirmation["seller_message"].(string); ok {
					confirmationMessage = strings.TrimSpace(message)
				}
				if reason, ok := rawConfirmation["reject_reason"].(string); ok {
					confirmationRejectReason = strings.TrimSpace(reason)
				}
			}
			if rawDispute, ok := metadata["dispute"].(map[string]any); ok {
				if reason, ok := rawDispute["customer_reason"].(string); ok {
					disputeCustomerReason = strings.TrimSpace(reason)
				}
				if note, ok := rawDispute["seller_note"].(string); ok {
					disputeSellerNote = strings.TrimSpace(note)
				}
				if decision, ok := rawDispute["admin_decision"].(string); ok {
					disputeAdminDecision = strings.TrimSpace(decision)
				}
				if note, ok := rawDispute["admin_note"].(string); ok {
					disputeAdminNote = strings.TrimSpace(note)
				}
				if note, ok := rawDispute["refund_note"].(string); ok {
					disputeRefundNote = strings.TrimSpace(note)
				}
			}
		}
	}
	return map[string]interface{}{
		"order_id":                           order.ID,
		"order_number":                       order.OrderNumber,
		"order_status":                       order.Status,
		"payment_status":                     paymentStatus,
		"grand_total":                        s.formatAmount(order.GrandTotal),
		"currency":                           order.Currency,
		"delivery_status":                    deliveryStatus,
		"shipment_status":                    shipmentStatus,
		"shipment_count":                     shipmentCount,
		"carrier_name":                       carrierName,
		"service_name":                       serviceName,
		"tracking_number":                    trackingNumber,
		"estimated_delivery":                 estimatedDelivery,
		"customer_name":                      s.fallbackString(customerName, "Customer"),
		"customer_email":                     customerEmail,
		"customer_locale":                    customerLocale,
		"business_name":                      storeName,
		"confirmation_status":                confirmationStatus,
		"confirmation_message":               confirmationMessage,
		"confirmation_reject_reason":         confirmationRejectReason,
		"dispute_customer_reason":            disputeCustomerReason,
		"dispute_seller_note":                disputeSellerNote,
		"dispute_admin_decision":             disputeAdminDecision,
		"dispute_admin_note":                 disputeAdminNote,
		"dispute_refund_note":                disputeRefundNote,
		"dispute_confirmation_reject_reason": confirmationRejectReason,
		"order_link":                         "/admin/orders",
	}
}

func (s *Service) renderTemplate(input string, data map[string]interface{}) (string, error) {
	tpl, err := txttpl.New("notification").Option("missingkey=zero").Parse(input)
	if err != nil {
		return "", err
	}
	buf := bytes.Buffer{}
	if err := tpl.Execute(&buf, data); err != nil {
		return "", err
	}
	return strings.TrimSpace(buf.String()), nil
}

func (s *Service) splitRecipients(value string) []string {
	value = strings.NewReplacer(";", ",", "\n", ",").Replace(value)
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	seen := map[string]struct{}{}
	for _, part := range parts {
		email := strings.TrimSpace(part)
		if email == "" {
			continue
		}
		if _, ok := seen[email]; ok {
			continue
		}
		seen[email] = struct{}{}
		result = append(result, email)
	}
	return result
}

func (s *Service) fallbackString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func (s *Service) formatAmount(value float64) string {
	return strconv.FormatFloat(value, 'f', 2, 64)
}
