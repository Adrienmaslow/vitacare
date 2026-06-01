// frontend/src/pages/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', password: '', role: 'patient' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Mot de passe trop court (min. 6 caractères)'); return; }
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">🧠</div>
          <h1>Créer un compte</h1>
          <p>Rejoignez VitaCare aujourd'hui</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>Prénom</label>
              <input type="text" value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Nom</label>
              <input type="text" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} required />
            </div>
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          </div>

          <div className="form-group">
            <label>Mot de passe</label>
            <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={6} />
          </div>

          <div className="form-group">
            <label>Je suis</label>
            <div className="role-selector">
              <button type="button" className={`role-btn ${form.role === 'patient' ? 'active' : ''}`}
                onClick={() => setForm({...form, role: 'patient'})}>
                <span>🙋</span> Patient
              </button>
              <button type="button" className={`role-btn ${form.role === 'praticien' ? 'active' : ''}`}
                onClick={() => setForm({...form, role: 'praticien'})}>
                <span>👨‍⚕️</span> Praticien
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        <p className="auth-footer">
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
