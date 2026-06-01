// frontend/src/pages/Reservations.jsx
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Reservations() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('tous');

  const load = () => {
    setLoading(true);
    api.get('/reservations.php?action=list').then(setReservations).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (id) => {
    if (!confirm('Annuler cette réservation ?')) return;
    try {
      await api.get(`/reservations.php?action=cancel&id=${id}`);
      load();
    } catch (err) { alert(err.message); }
  };

  const fmt = (dt) => new Date(dt).toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  const filtered = filter === 'tous' ? reservations : reservations.filter(r => r.statut === filter);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Mes rendez-vous</h1>
        <p>Historique et suivi de vos réservations</p>
      </div>

      <div className="tabs">
        {['tous', 'confirme', 'en_attente', 'termine', 'annule'].map(s => (
          <button key={s} className={`tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'tous' ? 'Tous' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        filtered.length === 0 ? <div className="empty">Aucune réservation</div> : (
          <div className="reservations-list">
            {filtered.map(r => (
              <div key={r.id} className="reservation-card">
                <div className="rc-left">
                  <div className="rc-date">
                    <span className="rc-day">{new Date(r.date_heure_debut).getDate()}</span>
                    <span className="rc-month">{new Date(r.date_heure_debut).toLocaleDateString('fr', { month: 'short' })}</span>
                  </div>
                </div>
                <div className="rc-main">
                  <h4>{r.service_titre}</h4>
                  <p>{fmt(r.date_heure_debut)} — {new Date(r.date_heure_fin).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}</p>
                  {user?.role === 'patient' && <p>👨‍⚕️ {r.praticien_prenom} {r.praticien_nom}</p>}
                  {user?.role !== 'patient' && <p>🙋 {r.patient_prenom} {r.patient_nom}</p>}
                  {r.montant_paye && <p>💶 {parseFloat(r.montant_paye).toFixed(2)}€</p>}
                </div>
                <div className="rc-right">
                  <span className={`badge-status ${r.statut}`}>{r.statut.replace('_', ' ')}</span>
                  {r.statut === 'confirme' && user?.role === 'patient' && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleCancel(r.id)}>Annuler</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
