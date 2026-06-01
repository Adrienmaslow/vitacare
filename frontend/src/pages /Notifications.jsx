// frontend/src/pages/Notifications.jsx
import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function Notifications() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get('/notifications.php?action=list').then(setNotifs).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    await api.get('/notifications.php?action=mark_read');
    load();
  };

  const markRead = async (id) => {
    await api.get(`/notifications.php?action=mark_read&id=${id}`);
    load();
  };

  const deleteNotif = async (id) => {
    await api.get(`/notifications.php?action=delete&id=${id}`);
    load();
  };

  const typeIcon = (t) => ({ reservation: '📅', annulation: '❌', rappel: '🔔', systeme: 'ℹ️', message: '✉️' }[t] || '🔔');
  const fmt = (dt) => new Date(dt).toLocaleDateString('fr', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page">
      <div className="page-header notif-header">
        <h1>🔔 Notifications</h1>
        <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Tout marquer comme lu</button>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        notifs.length === 0 ? <div className="empty">Aucune notification</div> : (
          <div className="notifs-list">
            {notifs.map(n => (
              <div key={n.id} className={`notif-item ${!n.est_lu ? 'unread' : ''}`}>
                <span className="notif-icon">{typeIcon(n.type)}</span>
                <div className="notif-body" onClick={() => markRead(n.id)}>
                  <strong>{n.titre}</strong>
                  <p>{n.message}</p>
                  <small>{fmt(n.date_creation)}</small>
                </div>
                <button className="btn-remove" onClick={() => deleteNotif(n.id)}>✕</button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
