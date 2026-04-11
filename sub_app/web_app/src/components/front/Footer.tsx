import React from 'react';
import { ShoppingBag, Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-slate-200 pt-16 pb-8 mt-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                GoSeller
              </span>
            </div>
            <p className="text-slate-500 leading-relaxed max-w-xs">
              Platform terbaik untuk menemukan produk berkualitas dari ribuan bisnis terpercaya di seluruh Indonesia.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors" aria-label="Social link 1">
                <span className="text-sm font-semibold">f</span>
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors" aria-label="Social link 2">
                <span className="text-sm font-semibold">ig</span>
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors" aria-label="Social link 3">
                <span className="text-sm font-semibold">x</span>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-slate-900 mb-6">Belanja</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-slate-500 hover:text-emerald-600 transition-colors">Semua Produk</a></li>
              <li><a href="#" className="text-slate-500 hover:text-emerald-600 transition-colors">Kategori Populer</a></li>
              <li><a href="#" className="text-slate-500 hover:text-emerald-600 transition-colors">Promo Spesial</a></li>
              <li><a href="#" className="text-slate-500 hover:text-emerald-600 transition-colors">Toko Terverifikasi</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-bold text-slate-900 mb-6">Bantuan</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-slate-500 hover:text-emerald-600 transition-colors">Pusat Bantuan</a></li>
              <li><a href="#" className="text-slate-500 hover:text-emerald-600 transition-colors">Lacak Pesanan</a></li>
              <li><a href="#" className="text-slate-500 hover:text-emerald-600 transition-colors">Syarat & Ketentuan</a></li>
              <li><a href="#" className="text-slate-500 hover:text-emerald-600 transition-colors">Kebijakan Privasi</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-slate-900 mb-6">Kontak Kami</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-slate-500">Jl. Teknologi No. 42, Jakarta Selatan, Indonesia</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-slate-500">+62 21 1234 5678</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-slate-500">support@goseller.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-sm">
            © {currentYear} GoSeller. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
             <img src="/payment-methods.png" alt="Payment Methods" className="h-6 opacity-50 grayscale hover:grayscale-0 transition-all cursor-help" title="Visa, Mastercard, Bank Transfer, E-Wallet" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
