import { Lilita_One, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "../lib/cart";

// Plus Jakarta Sans buat semua teks, Lilita One cuma buat logo "PO KRIPIK" & stiker.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const lilita = Lilita_One({ subsets: ["latin"], weight: "400", variable: "--font-lilita", display: "swap" });

export const metadata = {
  title: "PO Kripik",
  description: "Pre-order camilan rumahan, khusus diantar ke Capital Place. Pesan, bayar QRIS, tinggal tunggu.",
};

export const viewport = {
  themeColor: "#fff8ed",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${lilita.variable}`}>
      <body>
        <CartProvider>
          <div className="relative mx-auto min-h-screen max-w-md overflow-x-clip">{children}</div>
        </CartProvider>
      </body>
    </html>
  );
}
