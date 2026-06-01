// frontend/src/context/CartContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState({ items: [], total: 0 });

  const fetchCart = async () => {
    if (!user || user.role !== 'patient') return;
    try {
      const data = await api.get('/panier.php?action=list');
      setCart(data);
    } catch {}
  };

  useEffect(() => { fetchCart(); }, [user]);

  const addToCart = async (type, refId) => {
    await api.post('/panier.php?action=add', { type, ref_id: refId });
    await fetchCart();
  };

  const removeFromCart = async (id) => {
    await api.get(`/panier.php?action=remove&id=${id}`);
    await fetchCart();
  };

  const checkout = async () => {
    const data = await api.post('/panier.php?action=checkout', {});
    await fetchCart();
    return data;
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, checkout, fetchCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
