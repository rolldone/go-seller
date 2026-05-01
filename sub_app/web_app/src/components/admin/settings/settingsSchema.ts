export type FieldType = "text" | "number" | "boolean" | "select" | "textarea";

export type SettingField = {
  key: string;
  scope: string;
  label: string;
  type: FieldType;
  description?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  defaultValue: unknown;
};

export type SettingGroup = {
  id: string;
  title: string;
  description?: string;
  fields: SettingField[];
};

export const SETTING_GROUPS: SettingGroup[] = [
  {
    id: "store",
    title: "Toko",
    description: "Informasi umum toko yang tampil di struk dan invoice.",
    fields: [
      {
        key: "store.name",
        scope: "global",
        label: "Nama Toko",
        type: "text",
        placeholder: "My Store",
        defaultValue: "",
      },
      {
        key: "store.currency",
        scope: "global",
        label: "Mata Uang",
        type: "select",
        options: [
          { value: "IDR", label: "IDR – Rupiah" },
          { value: "USD", label: "USD – Dollar" },
          { value: "SGD", label: "SGD – Singapore Dollar" },
          { value: "MYR", label: "MYR – Ringgit" },
        ],
        defaultValue: "IDR",
      },
      {
        key: "store.amount_format",
        scope: "global",
        label: "Format Nominal",
        type: "select",
        options: [
          { value: "id", label: "Indonesia (1.234.567,89)" },
          { value: "us", label: "US (1,234,567.89)" },
          { value: "custom", label: "Custom" },
        ],
        defaultValue: "id",
        description: "Pilih format angka yang dipakai untuk harga dan nominal lain di aplikasi.",
      },
      {
        key: "store.amount_thousand_separator",
        scope: "global",
        label: "Separator Ribuan",
        type: "text",
        placeholder: ".",
        defaultValue: ".",
        description: "Dipakai saat format nominal mode custom.",
      },
      {
        key: "store.amount_decimal_separator",
        scope: "global",
        label: "Separator Desimal",
        type: "text",
        placeholder: ",",
        defaultValue: ",",
        description: "Dipakai saat format nominal mode custom.",
      },
      {
        key: "store.timezone",
        scope: "global",
        label: "Timezone",
        type: "select",
        options: [
          { value: "Asia/Jakarta", label: "WIB – Asia/Jakarta" },
          { value: "Asia/Makassar", label: "WITA – Asia/Makassar" },
          { value: "Asia/Jayapura", label: "WIT – Asia/Jayapura" },
          { value: "UTC", label: "UTC" },
        ],
        defaultValue: "Asia/Jakarta",
      },
      {
        key: "store.phone",
        scope: "global",
        label: "No. Telepon",
        type: "text",
        placeholder: "+62812xxxxxxxx",
        defaultValue: "",
      },
      {
        key: "store.email",
        scope: "global",
        label: "Email Kontak",
        type: "text",
        placeholder: "support@domain.com",
        defaultValue: "",
      },
      {
        key: "store.address",
        scope: "global",
        label: "Alamat",
        type: "textarea",
        placeholder: "Jl. ...",
        defaultValue: "",
      },
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance",
    description: "Atur maintenance mode untuk halaman publik yang ingin ditutup sementara.",
    fields: [
      {
        key: "maintenance.index",
        scope: "global",
        label: "Maintenance Beranda",
        type: "boolean",
        defaultValue: false,
        description: "Jika aktif, halaman index akan menampilkan pesan maintenance untuk pengunjung.",
      },
      {
        key: "maintenance.business_page",
        scope: "global",
        label: "Maintenance Halaman Toko",
        type: "boolean",
        defaultValue: false,
        description: "Jika aktif, halaman toko akan menampilkan pesan maintenance untuk pengunjung.",
      },
      {
        key: "maintenance.product_detail",
        scope: "global",
        label: "Maintenance Halaman Detail Produk",
        type: "boolean",
        defaultValue: false,
        description: "Jika aktif, halaman detail produk akan menampilkan pesan maintenance untuk pengunjung.",
      },
    ],
  },
  {
    id: "tax",
    title: "Pajak",
    description: "Konfigurasi pajak yang diterapkan pada transaksi.",
    fields: [
      {
        key: "tax.enabled",
        scope: "global",
        label: "Aktifkan Pajak",
        type: "boolean",
        defaultValue: false,
      },
      {
        key: "tax.rate",
        scope: "global",
        label: "Tarif Pajak (%)",
        type: "number",
        min: 0,
        max: 100,
        placeholder: "11",
        defaultValue: 0,
        description: "Dalam persen, contoh: 11 untuk 11%",
      },
      {
        key: "tax.included_in_price",
        scope: "global",
        label: "Pajak Termasuk dalam Harga",
        type: "boolean",
        defaultValue: false,
        description: "Jika aktif, harga produk sudah include pajak (tax-inclusive).",
      },
      {
        key: "tax.label",
        scope: "global",
        label: "Label Pajak",
        type: "text",
        placeholder: "PPN",
        defaultValue: "PPN",
        description: "Nama pajak yang ditampilkan di struk.",
      },
    ],
  },
  {
    id: "discount",
    title: "Diskon",
    description: "Aturan dan batasan penerapan diskon.",
    fields: [
      {
        key: "discount.max_percent",
        scope: "global",
        label: "Maks Diskon (%)",
        type: "number",
        min: 0,
        max: 100,
        placeholder: "100",
        defaultValue: 100,
        description: "Batas maksimal diskon per item dalam persen.",
      },
      {
        key: "discount.allow_multiple",
        scope: "global",
        label: "Izinkan Diskon Bertumpuk",
        type: "boolean",
        defaultValue: false,
        description: "Jika aktif, lebih dari satu diskon bisa diterapkan per item.",
      },
    ],
  },
  {
    id: "order",
    title: "Order",
    description: "Pengaturan perilaku order dan transaksi.",
    fields: [
      {
        key: "order.min_amount",
        scope: "global",
        label: "Minimal Nilai Order",
        type: "number",
        min: 0,
        placeholder: "0",
        defaultValue: 0,
        description: "Nilai minimum transaksi dalam mata uang yang dipilih.",
      },
      {
        key: "order.auto_confirm",
        scope: "global",
        label: "Auto Konfirmasi",
        type: "boolean",
        defaultValue: false,
        description: "Order otomatis dikonfirmasi tanpa review manual.",
      },
      {
        key: "order.allow_notes",
        scope: "global",
        label: "Izinkan Catatan Order",
        type: "boolean",
        defaultValue: true,
      },
      {
        key: "order.expiry_hours",
        scope: "global",
        label: "Batas Expired Order (Jam)",
        type: "number",
        min: 0,
        placeholder: "24",
        defaultValue: 24,
        description: "Order unpaid akan otomatis expired setelah melewati jumlah jam ini. 0 menonaktifkan auto-expire.",
      },
    ],
  },
];
