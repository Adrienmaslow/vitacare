// frontend/src/pages/Profil.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Profil() {
  const { user } = useAuth();

  return (
    <div className="page">
      <div className="page-header">
        <h1>Mon profil</h1>
      </div>

      <div className="profil-card">
        <div className="profil-avatar">{user?.prenom?.[0]}{user?.nom?.[0]}</div>
        <div className="profil-info">
          <h2>{user?.prenom} {user?.nom}</h2>
          <span className={`badge-role ${user?.role}`}>{user?.role}</span>
          <p>📧 {user?.email}</p>
          {user?.telephone && <p>📞 {user?.telephone}</p>}
          {user?.bio && <p>📝 {user?.bio}</p>}
          <p>🗓 Membre depuis {new Date(user?.date_creation).toLocaleDateString('fr', { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="profil-note">
        <p>La modification du profil est disponible dans une prochaine version.</p>
      </div>
    </div>
  );
}
