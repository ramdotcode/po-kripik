import "./globals.css";
import { CartProvider } from "../lib/cart";

export const metadata = {
  title: "PO Kripik",
  description: "Pemesanan pre-order kripik & camilan",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <CartProvider>
          <div className="mx-auto min-h-screen max-w-md bg-brand-50">{children}</div>
        </CartProvider>
      </body>
    </html>
  );
}
