// frontend/src/pages/Home.jsx
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function Home() {
  const [services, setServices] = useState([]);
  const [activites, setActivites] = useState([]);

  useEffect(() => {
    api.get('/services.php?action=list').then(setServices).catch(() => {});
    api.get('/activites.php?action=list').then(setActivites).catch(() => {});
  }, []);

  const categories = [
    { nom: 'Psychologie', icone: '🧠', couleur: '#7C3AED' },
    { nom: 'Coaching', icone: '🎯', couleur: '#2563EB' },
    { nom: 'Méditation', icone: '🍃', couleur: '#059669' },
    { nom: 'Gestion du stress', icone: '💨', couleur: '#D97706' },
    { nom: 'Thérapie cognitive', icone: '💡', couleur: '#DC2626' },
    { nom: 'Bien-être', icone: '❤️', couleur: '#EC4899' },
  ];

  return (
    <div className="home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">🌿 Plateforme de santé mentale & coaching</div>
          <h1>Prenez soin de votre <span className="gradient-text">santé mentale</span></h1>
          <p>Consultez des psychologues, coachs et experts du bien-être. Réservez en ligne, suivez votre parcours, et avancez vers votre meilleur équilibre.</p>
          <div className="hero-cta">
            <Link to="/services" className="btn btn-primary btn-lg">Découvrir les services</Link>
            <Link to="/activites" className="btn btn-ghost btn-lg">Voir les activités</Link>
          </div>
          <div className="hero-stats">
            <div className="stat"><strong>50+</strong><span>Experts certifiés</span></div>
            <div className="stat"><strong>2000+</strong><span>Patients accompagnés</span></div>
            <div className="stat"><strong>4.8/5</strong><span>Note moyenne</span></div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card">
            <div className="hc-header">🧘 Prochaine séance</div>
            <div className="hc-title">Méditation guidée</div>
            <div className="hc-meta">Demain • 10h00 • 45 min</div>
            <div className="hc-practitioner">Avec Claire Bernard</div>
            <Link to="/services" className="btn btn-primary btn-sm">Réserver</Link>
          </div>
        </div>
      </section>

      {/* Catégories */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">Nos domaines d'expertise</h2>
          <div className="categories-grid">
            {categories.map((cat, i) => (
              <Link key={i} to={`/services?categorie=${i + 1}`} className="cat-card" style={{ '--cat-color': cat.couleur }}>
                <span className="cat-icon">{cat.icone}</span>
                <span className="cat-name">{cat.nom}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Services populaires */}
      {services.length > 0 && (
        <section className="section section-alt">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">Services populaires</h2>
              <Link to="/services" className="link-more">Voir tout →</Link>
            </div>
            <div className="services-grid">
              {services.slice(0, 4).map(s => (
                <Link key={s.id} to={`/services/${s.id}`} className="service-card">
                  <div className="sc-category" style={{ background: s.categorie_couleur + '20', color: s.categorie_couleur }}>
                    {s.categorie_nom}
                  </div>
                  <h3 className="sc-title">{s.titre}</h3>
                  <p className="sc-desc">{s.description?.substring(0, 80)}...</p>
                  <div className="sc-footer">
                    <div className="sc-practitioner">
                      <span className="sc-avatar">{s.praticien_prenom?.[0]}{s.praticien_nom?.[0]}</span>
                      {s.praticien_prenom} {s.praticien_nom}
                    </div>
                    <div className="sc-meta">
                      <span>⭐ {parseFloat(s.note_moyenne).toFixed(1)}</span>
                      <span className="sc-price">{parseFloat(s.prix).toFixed(0)}€</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Activités */}
      {activites.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">Activités à venir</h2>
              <Link to="/activites" className="link-more">Voir tout →</Link>
            </div>
            <div className="activites-list">
              {activites.slice(0, 3).map(a => (
                <div key={a.id} className="activite-card">
                  <div className="ac-date">
                    <span className="ac-day">{new Date(a.date_debut).getDate()}</span>
                    <span className="ac-month">{new Date(a.date_debut).toLocaleDateString('fr', { month: 'short' })}</span>
                  </div>
                  <div className="ac-info">
                    <h4>{a.titre}</h4>
                    <p>{a.praticien_prenom} {a.praticien_nom} • {a.lieu}</p>
                    <div className="ac-meta">
                      <span>👥 {a.places_restantes} places restantes</span>
                      <span>{parseFloat(a.prix) === 0 ? 'Gratuit' : parseFloat(a.prix).toFixed(0) + '€'}</span>
                    </div>
                  </div>
                  <Link to="/activites" className="btn btn-outline btn-sm">S'inscrire</Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="cta-section">
        <div className="container">
          <h2>Prêt à prendre soin de vous ?</h2>
          <p>Rejoignez des milliers de personnes qui ont amélioré leur bien-être mental avec VitaCare.</p>
          <Link to="/register" className="btn btn-primary btn-lg">Commencer gratuitement</Link>
        </div>
      </section>
    </div>
  );
}
