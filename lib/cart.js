"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState({}); // { productId: { product, qty } }
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let awal = {};
    try {
      const saved = localStorage.getItem("kripik-cart");
      if (saved) awal = JSON.parse(saved) || {};
    } catch {}
    setItems(awal);
    setLoaded(true);

    // Isi keranjang = salinan produk saat ditambahkan. Admin bisa ubah harga/nama/foto
    // atau hapus menu sejak itu, jadi samakan dengan data terbaru; yang hilang/nonaktif dibuang.
    const ids = Object.keys(awal);
    if (ids.length === 0) return;
    supabase
      .from("products")
      .select("*")
      .in("id", ids)
      .then(({ data, error }) => {
        if (error || !data) return; // gagal baca = biarkan apa adanya, server tetap cek ulang saat pesan
        const byId = new Map(data.filter((p) => p.active).map((p) => [p.id, p]));
        setItems((prev) => {
          const next = {};
          for (const [id, it] of Object.entries(prev)) {
            const p = byId.get(id);
            if (p) next[id] = { product: p, qty: it.qty };
          }
          return next;
        });
      });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("kripik-cart", JSON.stringify(items));
    } catch {}
  }, [items, loaded]);

  const setQty = (product, qty) => {
    setItems((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[product.id];
      else next[product.id] = { product, qty };
      return next;
    });
  };

  const clear = () => setItems({});

  const list = Object.values(items);
  const totalQty = list.reduce((s, i) => s + i.qty, 0);
  const totalPrice = list.reduce((s, i) => s + i.qty * i.product.price, 0);

  return (
    <CartContext.Provider value={{ items, list, setQty, clear, totalQty, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
