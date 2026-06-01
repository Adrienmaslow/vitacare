// frontend/src/components/Layout.jsx
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useState } from 'react';

export default function Layout() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="app">
      <nav className="navbar">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🧠</span>
          <span className="brand-name">VitaCare</span>
          <span className="brand-tagline">Santé mentale & Coaching</span>
        </Link>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <Link to="/services" className={isActive('/services') ? 'active' : ''} onClick={() => setMenuOpen(false)}>Services</Link>
          <Link to="/activites" className={isActive('/activites') ? 'active' : ''} onClick={() => setMenuOpen(false)}>Activités</Link>
          {user && <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''} onClick={() => setMenuOpen(false)}>Tableau de bord</Link>}
          {user && <Link to="/reservations" className={isActive('/reservations') ? 'active' : ''} onClick={() => setMenuOpen(false)}>Mes rendez-vous</Link>}
        </div>

        <div className="navbar-actions">
          {user ? (
            <>
              {user.role === 'patient' && (
                <Link to="/panier" className="btn-icon" title="Panier">
                  🛒 {cart.items?.length > 0 && <span className="badge">{cart.items.length}</span>}
                </Link>
              )}
              <Link to="/notifications" className="btn-icon" title="Notifications">🔔</Link>
              <div className="user-menu">
                <button className="user-btn" onClick={() => setMenuOpen(!menuOpen)}>
                  <span className="avatar">{user.prenom[0]}{user.nom[0]}</span>
                  <span className="user-name">{user.prenom}</span>
                </button>
                <div className="dropdown">
                  <Link to="/profil">Mon profil</Link>
                  <button onClick={handleLogout}>Déconnexion</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">Connexion</Link>
              <Link to="/register" className="btn btn-primary">S'inscrire</Link>
            </>
          )}
          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div>
            <strong>🧠 VitaCare</strong> — Votre santé mentale, notre priorité
          </div>
          <div className="footer-links">
            <Link to="/services">Services</Link>
            <Link to="/activites">Activités</Link>
          </div>
          <div className="footer-copy">© 2026 VitaCare — Adrien, Raphaël, Axel</div>
        </div>
      </footer>
    </div>
  );
}
