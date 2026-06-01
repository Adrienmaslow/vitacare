// frontend/src/pages/Panier.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function Panier() {
  const { cart, removeFromCart, checkout } = useCart();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      await checkout();
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="page">
      <div className="success-page">
        <div className="success-icon">✅</div>
        <h2>Paiement simulé confirmé !</h2>
        <p>Vos réservations ont été validées avec succès.</p>
        <Link to="/reservations" className="btn btn-primary">Voir mes réservations</Link>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>🛒 Panier de réservations</h1>
        <p>{cart.items?.length || 0} élément(s)</p>
      </div>

      {!cart.items?.length ? (
        <div className="empty-cart">
          <p>Votre panier est vide</p>
          <Link to="/services" className="btn btn-primary">Découvrir les services</Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {cart.items.map(item => (
              <div key={item.id} className="cart-item">
                <div className="ci-info">
                  <h4>{item.titre}</h4>
                  <p>{item.type === 'reservation' ? '📅' : '👥'} {item.date_debut ? new Date(item.date_debut).toLocaleDateString('fr', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  <p>👤 {item.praticien}</p>
                </div>
                <div className="ci-right">
                  <span className="ci-price">{parseFloat(item.prix || 0).toFixed(2)}€</span>
                  <button className="btn-remove" onClick={() => removeFromCart(item.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <h3>Résumé</h3>
            {cart.items.map(item => (
              <div key={item.id} className="summary-line">
                <span>{item.titre?.substring(0, 25)}...</span>
                <span>{parseFloat(item.prix || 0).toFixed(2)}€</span>
              </div>
            ))}
            <div className="summary-total">
              <strong>Total</strong>
              <strong>{parseFloat(cart.total || 0).toFixed(2)}€</strong>
            </div>

            <div className="payment-sim">
              <h4>💳 Paiement simulé</h4>
              <input type="text" value="4242 4242 4242 4242" readOnly />
              <div className="payment-row">
                <input type="text" value="12/28" readOnly />
                <input type="text" value="123" readOnly />
              </div>
              <p className="payment-note">⚠️ Aucun paiement réel ne sera effectué</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="cart-checks">
              <p>✅ Disponibilités vérifiées</p>
              <p>✅ Conditions respectées</p>
            </div>

            <button className="btn btn-primary btn-full" onClick={handleCheckout} disabled={loading}>
              {loading ? 'Validation...' : 'Valider et payer (simulation)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
