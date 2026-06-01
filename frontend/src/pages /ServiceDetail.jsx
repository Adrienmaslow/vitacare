// frontend/src/pages/ServiceDetail.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function ServiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [service, setService] = useState(null);
  const [creneaux, setCreneaux] = useState([]);
  const [selectedCreneau, setSelectedCreneau] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingMsg, setBookingMsg] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/services.php?action=detail&id=${id}`),
      api.get(`/services.php?action=creneaux&id=${id}`)
    ]).then(([s, c]) => {
      setService(s);
      setCreneaux(c);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleBook = async () => {
    if (!user) { navigate('/login'); return; }
    if (!selectedCreneau) { setBookingMsg('Sélectionnez un créneau'); return; }
    try {
      await api.post('/reservations.php?action=create', { creneau_id: selectedCreneau });
      setBookingMsg('✅ Réservation confirmée !');
    } catch (err) {
      setBookingMsg('❌ ' + err.message);
    }
  };

  const handleAddCart = async () => {
    if (!user) { navigate('/login'); return; }
    if (!selectedCreneau) { setBookingMsg('Sélectionnez un créneau'); return; }
    try {
      await addToCart('reservation', selectedCreneau);
      setBookingMsg('✅ Ajouté au panier !');
    } catch (err) {
      setBookingMsg('❌ ' + err.message);
    }
  };

  const formatDate = (dt) => new Date(dt).toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!service) return <div className="page"><div className="empty">Service introuvable</div></div>;

  return (
    <div className="page">
      <div className="detail-layout">
        {/* Infos principales */}
        <div className="detail-main">
          <div className="detail-badge" style={{ background: service.categorie_couleur + '20', color: service.categorie_couleur }}>
            {service.categorie_nom}
          </div>
          <h1>{service.titre}</h1>
          <div className="detail-meta">
            <span>⭐ {parseFloat(service.note_moyenne).toFixed(1)} ({service.nb_avis} avis)</span>
            <span>⏱ {service.duree_minutes} min</span>
            <span className="tag">{service.type}</span>
          </div>
          <p className="detail-desc">{service.description}</p>

          <div className="praticien-card">
            <div className="praticien-avatar">{service.praticien_prenom?.[0]}{service.praticien_nom?.[0]}</div>
            <div>
              <strong>{service.praticien_prenom} {service.praticien_nom}</strong>
              <p>{service.praticien_bio}</p>
            </div>
          </div>

          {/* Créneaux */}
          <div className="creneaux-section">
            <h3>Créneaux disponibles</h3>
            {creneaux.length === 0 ? (
              <div className="empty">Aucun créneau disponible actuellement</div>
            ) : (
              <div className="creneaux-list">
                {creneaux.map(c => (
                  <button key={c.id}
                    className={`creneau-btn ${selectedCreneau === c.id ? 'selected' : ''} ${c.places_restantes <= 0 ? 'full' : ''}`}
                    onClick={() => c.places_restantes > 0 && setSelectedCreneau(c.id)}
                    disabled={c.places_restantes <= 0}>
                    <span className="cr-date">{formatDate(c.date_heure_debut)}</span>
                    <span className="cr-places">{c.places_restantes > 0 ? `${c.places_restantes} place(s)` : 'Complet'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panneau de réservation */}
        <div className="booking-panel">
          <div className="booking-price">{parseFloat(service.prix).toFixed(2)}€</div>
          <p className="booking-per">par séance</p>

          {bookingMsg && <div className={`alert ${bookingMsg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>{bookingMsg}</div>}

          {selectedCreneau && (
            <div className="booking-summary">
              <strong>Créneau sélectionné :</strong><br />
              {formatDate(creneaux.find(c => c.id === selectedCreneau)?.date_heure_debut)}
            </div>
          )}

          {user?.role === 'patient' && (
            <>
              <button className="btn btn-primary btn-full" onClick={handleBook}>Réserver maintenant</button>
              <button className="btn btn-outline btn-full" onClick={handleAddCart}>Ajouter au panier</button>
            </>
          )}
          {!user && (
            <button className="btn btn-primary btn-full" onClick={() => navigate('/login')}>
              Connexion pour réserver
            </button>
          )}

          <div className="booking-info">
            <p>✅ Annulation gratuite 24h avant</p>
            <p>✅ Paiement sécurisé simulé</p>
            <p>✅ Confirmation immédiate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
