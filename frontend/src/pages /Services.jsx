// frontend/src/pages/Services.jsx
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';

export default function Services() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') || '';
  const categorie = searchParams.get('categorie') || '';
  const type = searchParams.get('type') || '';
  const sort = searchParams.get('sort') || 'note';

  useEffect(() => {
    api.get('/categories.php').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categorie) params.set('categorie', categorie);
    if (type) params.set('type', type);
    if (sort) params.set('sort', sort);
    api.get(`/services.php?action=list&${params}`)
      .then(setServices)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, categorie, type, sort]);

  const setParam = (key, value) => {
    const np = new URLSearchParams(searchParams);
    if (value) np.set(key, value); else np.delete(key);
    setSearchParams(np);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Catalogue des services</h1>
        <p>Trouvez les services qui répondent à vos besoins</p>
      </div>

      <div className="page-body">
        {/* Filtres */}
        <aside className="filters">
          <h3>Filtres</h3>

          <div className="filter-group">
            <label>Recherche</label>
            <input type="text" placeholder="Rechercher..." value={search}
              onChange={e => setParam('search', e.target.value)} />
          </div>

          <div className="filter-group">
            <label>Catégorie</label>
            <button className={`filter-btn ${!categorie ? 'active' : ''}`} onClick={() => setParam('categorie', '')}>Toutes</button>
            {categories.map(c => (
              <button key={c.id} className={`filter-btn ${categorie == c.id ? 'active' : ''}`}
                onClick={() => setParam('categorie', c.id)}>{c.nom}</button>
            ))}
          </div>

          <div className="filter-group">
            <label>Type</label>
            {[['', 'Tous'], ['individuel', 'Individuel'], ['groupe', 'Groupe'], ['programme', 'Programme']].map(([val, label]) => (
              <button key={val} className={`filter-btn ${type === val ? 'active' : ''}`}
                onClick={() => setParam('type', val)}>{label}</button>
            ))}
          </div>

          <div className="filter-group">
            <label>Trier par</label>
            <select value={sort} onChange={e => setParam('sort', e.target.value)}>
              <option value="note">Meilleures notes</option>
              <option value="prix_asc">Prix croissant</option>
              <option value="prix_desc">Prix décroissant</option>
            </select>
          </div>
        </aside>

        {/* Résultats */}
        <div className="results">
          <div className="results-header">
            <span>{services.length} service(s) trouvé(s)</span>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : services.length === 0 ? (
            <div className="empty">Aucun service trouvé</div>
          ) : (
            <div className="services-grid">
              {services.map(s => (
                <Link key={s.id} to={`/services/${s.id}`} className="service-card">
                  <div className="sc-category" style={{ background: s.categorie_couleur + '20', color: s.categorie_couleur }}>
                    {s.categorie_nom}
                  </div>
                  <h3 className="sc-title">{s.titre}</h3>
                  <p className="sc-desc">{s.description?.substring(0, 100)}...</p>
                  <div className="sc-tags">
                    <span className="tag">{s.type}</span>
                    <span className="tag">{s.duree_minutes} min</span>
                  </div>
                  <div className="sc-footer">
                    <div className="sc-practitioner">
                      <span className="sc-avatar">{s.praticien_prenom?.[0]}{s.praticien_nom?.[0]}</span>
                      {s.praticien_prenom} {s.praticien_nom}
                    </div>
                    <div className="sc-meta">
                      <span>⭐ {parseFloat(s.note_moyenne).toFixed(1)} ({s.nb_avis})</span>
                      <span className="sc-price">{parseFloat(s.prix).toFixed(0)}€</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
