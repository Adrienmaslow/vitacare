// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import Activites from './pages/Activites';
import Reservations from './pages/Reservations';
import Dashboard from './pages/Dashboard';
import Panier from './pages/Panier';
import Notifications from './pages/Notifications';
import Profil from './pages/Profil';

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="services" element={<Services />} />
              <Route path="services/:id" element={<ServiceDetail />} />
              <Route path="activites" element={<Activites />} />
              <Route path="dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="reservations" element={<PrivateRoute><Reservations /></PrivateRoute>} />
              <Route path="panier" element={<PrivateRoute roles={['patient']}><Panier /></PrivateRoute>} />
              <Route path="notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
              <Route path="profil" element={<PrivateRoute><Profil /></PrivateRoute>} />
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
