"use client";

import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState({}); // { productId: { product, qty } }
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kripik-cart");
      if (saved) setItems(JSON.parse(saved));
    } catch {}
    setLoaded(true);
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
