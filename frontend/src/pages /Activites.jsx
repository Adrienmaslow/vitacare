// frontend/src/pages/Activites.jsx
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';

export default function Activites() {
  const [activites, setActivites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState({});
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    const params = search ? `&search=${encodeURIComponent(search)}` : '';
    api.get(`/activites.php?action=list${params}`).then(setActivites).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const handleInscrire = async (id) => {
    if (!user) { navigate('/login'); return; }
    try {
      await api.get(`/activites.php?action=inscrire&id=${id}`);
      setMsg(m => ({ ...m, [id]: '✅ Inscrit !' }));
      load();
    } catch (err) {
      setMsg(m => ({ ...m, [id]: '❌ ' + err.message }));
    }
  };

  const handleAddCart = async (id) => {
    if (!user) { navigate('/login'); return; }
    try {
      await addToCart('activite', id);
      setMsg(m => ({ ...m, [id]: '✅ Ajouté au panier' }));
    } catch (err) {
      setMsg(m => ({ ...m, [id]: '❌ ' + err.message }));
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Activités & Programmes</h1>
        <p>Découvrez et participez aux activités pour votre bien-être</p>
      </div>

      <div className="search-bar">
        <input type="text" placeholder="Rechercher une activité..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div className="activites-grid">
          {activites.length === 0 ? <div className="empty">Aucune activité disponible</div> : activites.map(a => (
            <div key={a.id} className="activite-detail-card">
              <div className="adc-header" style={{ background: (a.couleur || '#7C3AED') + '20' }}>
                <span className="adc-cat" style={{ color: a.couleur || '#7C3AED' }}>{a.categorie_nom}</span>
                <span className="adc-places">{a.places_restantes} places</span>
              </div>
              <div className="adc-body">
                <h3>{a.titre}</h3>
                <p>{a.description?.substring(0, 120)}...</p>
                <div className="adc-meta">
                  <span>📅 {new Date(a.date_debut).toLocaleDateString('fr', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                  <span>📍 {a.lieu}</span>
                  <span>👤 {a.praticien_prenom} {a.praticien_nom}</span>
                  <span>💶 {parseFloat(a.prix) === 0 ? 'Gratuit' : parseFloat(a.prix).toFixed(0) + '€'}</span>
                </div>
                {msg[a.id] && <div className={`alert ${msg[a.id].startsWith('✅') ? 'alert-success' : 'alert-error'}`}>{msg[a.id]}</div>}
                <div className="adc-actions">
                  <button className="btn btn-primary" onClick={() => handleInscrire(a.id)} disabled={a.places_restantes <= 0}>
                    {a.places_restantes <= 0 ? 'Complet' : "S'inscrire"}
                  </button>
                  {user?.role === 'patient' && (
                    <button className="btn btn-outline" onClick={() => handleAddCart(a.id)}>+ Panier</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
