// frontend/src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard.php').then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const fmt = (dt) => new Date(dt).toLocaleDateString('fr', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Bonjour, {user?.prenom} 👋</h1>
        <p>Tableau de bord {user?.role === 'admin' ? 'administrateur' : user?.role === 'praticien' ? 'praticien' : 'patient'}</p>
      </div>

      {/* Admin dashboard */}
      {user?.role === 'admin' && data && (
        <div className="dashboard">
          <div className="stats-row">
            <div className="stat-card"><div className="stat-num">{data.reservations_total}</div><div className="stat-label">Réservations</div></div>
            <div className="stat-card"><div className="stat-num">{data.patients_total}</div><div className="stat-label">Patients</div></div>
            <div className="stat-card"><div className="stat-num">{data.activites_total}</div><div className="stat-label">Activités</div></div>
            <div className="stat-card accent"><div className="stat-num">{data.en_attente}</div><div className="stat-label">En attente</div></div>
          </div>

          <div className="dashboard-grid">
            <div className="dash-section">
              <h3>Activités à venir</h3>
              {data.activites_a_venir?.map(a => (
                <div key={a.id} className="dash-item">
                  <div><strong>{a.titre}</strong><br/><small>{fmt(a.date_debut)} • {a.places_reservees}/{a.places_max} inscrits</small></div>
                </div>
              ))}
            </div>
            <div className="dash-section">
              <h3>Dernières réservations</h3>
              {data.dernieres_reservations?.map(r => (
                <div key={r.id} className="dash-item">
                  <div><strong>{r.patient_prenom} {r.patient_nom}</strong><br/><small>{r.service_titre} • {fmt(r.date_heure_debut)}</small></div>
                  <span className={`badge-status ${r.statut}`}>{r.statut}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Praticien dashboard */}
      {user?.role === 'praticien' && data && (
        <div className="dashboard">
          <div className="stats-row">
            <div className="stat-card"><div className="stat-num">{data.mes_reservations}</div><div className="stat-label">Mes réservations</div></div>
            <div className="stat-card"><div className="stat-num">{data.prochains_rdv?.length || 0}</div><div className="stat-label">Prochains RDV</div></div>
          </div>
          <div className="dash-section">
            <h3>Prochains rendez-vous</h3>
            {data.prochains_rdv?.length === 0 ? <p className="empty">Aucun rendez-vous à venir</p> : data.prochains_rdv?.map(r => (
              <div key={r.id} className="dash-item">
                <div><strong>{r.patient_prenom} {r.patient_nom}</strong><br/><small>{r.service_titre} • {fmt(r.date_heure_debut)}</small></div>
                <span className={`badge-status ${r.statut}`}>{r.statut}</span>
              </div>
            ))}
          </div>
          <div className="dash-actions">
            <Link to="/reservations" className="btn btn-primary">Toutes mes réservations</Link>
          </div>
        </div>
      )}

      {/* Patient dashboard */}
      {user?.role === 'patient' && data && (
        <div className="dashboard">
          <div className="stats-row">
            <div className="stat-card"><div className="stat-num">{data.total_reservations}</div><div className="stat-label">Total réservations</div></div>
            <div className="stat-card"><div className="stat-num">{data.prochains_rdv?.length || 0}</div><div className="stat-label">RDV à venir</div></div>
            <div className="stat-card"><div className="stat-num">{data.mes_activites?.length || 0}</div><div className="stat-label">Activités inscrites</div></div>
          </div>

          <div className="dashboard-grid">
            <div className="dash-section">
              <h3>Prochains rendez-vous</h3>
              {data.prochains_rdv?.length === 0 ? (
                <div className="empty-cta"><p>Aucun rendez-vous prévu</p><Link to="/services" className="btn btn-primary btn-sm">Réserver</Link></div>
              ) : data.prochains_rdv?.map(r => (
                <div key={r.id} className="dash-item">
                  <div><strong>{r.service_titre}</strong><br/><small>Avec {r.praticien_prenom} {r.praticien_nom} • {fmt(r.date_heure_debut)}</small></div>
                  <span className={`badge-status ${r.statut}`}>{r.statut}</span>
                </div>
              ))}
            </div>
            <div className="dash-section">
              <h3>Mes activités</h3>
              {data.mes_activites?.length === 0 ? (
                <div className="empty-cta"><p>Pas d'activité inscrite</p><Link to="/activites" className="btn btn-primary btn-sm">Explorer</Link></div>
              ) : data.mes_activites?.map(a => (
                <div key={a.id} className="dash-item">
                  <div><strong>{a.titre}</strong><br/><small>{fmt(a.date_debut)} • {a.lieu}</small></div>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-actions">
            <Link to="/services" className="btn btn-primary">Découvrir les services</Link>
            <Link to="/reservations" className="btn btn-outline">Mes réservations</Link>
          </div>
        </div>
      )}
    </div>
  );
}
