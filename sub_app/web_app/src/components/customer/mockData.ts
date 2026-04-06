export const customerUser = {
  name: "Budi Santoso",
  email: "budi@email.com",
  initials: "BS",
  joinDate: "Bergabung sejak Maret 2024",
};

export const customerStats = [
  { label: "Total Pesanan", value: "12" },
  { label: "Menunggu", value: "2" },
  { label: "Selesai", value: "10" },
];

export const customerOrders = [
  {
    id: "ORD-001",
    product: "Growth OS Starter",
    store: "Bravo Six",
    status: "Selesai",
    date: "10 Mar 2026",
    price: "Rp 599.000",
  },
  {
    id: "ORD-002",
    product: "Mini SEO Sprint",
    store: "Whop University",
    status: "Diproses",
    date: "12 Mar 2026",
    price: "Rp 1.890.000",
  },
];

export const customerWishlist = [
  {
    id: "WIS-001",
    product: "Launch Copy Bundle",
    store: "Bravo Six",
    price: "Rp 349.000",
  },
  {
    id: "WIS-002",
    product: "Creator CRM Lite",
    store: "Whop University",
    price: "Rp 799.000",
  },
];

export const customerAddresses = [
  {
    id: "ADDR-001",
    label: "Rumah",
    receiver: "Budi Santoso",
    phone: "+62 812 9988 7766",
    address: "Jl. Merdeka No. 18, Bandung, Jawa Barat 40123",
    isPrimary: true,
  },
  {
    id: "ADDR-002",
    label: "Kantor",
    receiver: "Budi Santoso",
    phone: "+62 812 9988 7766",
    address: "Jl. Gatot Subroto No. 77, Jakarta Selatan 12950",
    isPrimary: false,
  },
];

export const customerNotifications = [
  {
    id: "NOTIF-001",
    title: "Pesanan ORD-002 sedang diproses",
    time: "2 jam lalu",
    unread: true,
  },
  {
    id: "NOTIF-002",
    title: "Promo gratis ongkir hingga Rp25.000",
    time: "1 hari lalu",
    unread: false,
  },
  {
    id: "NOTIF-003",
    title: "Pesanan ORD-001 telah selesai",
    time: "3 hari lalu",
    unread: false,
  },
];

export const customerAccountSettings = [
  { key: "Bahasa", value: "Indonesia" },
  { key: "Mata Uang", value: "IDR (Rp)" },
  { key: "Newsletter", value: "Aktif" },
  { key: "Notifikasi Email", value: "Aktif" },
];
