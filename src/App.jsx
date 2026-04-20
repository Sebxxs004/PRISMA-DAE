import React, { useState, useEffect } from 'react';
import useAuthStore from './store/useAuthStore';
import LoginPage from './pages/LoginPage';
import DashboardAdmin from './pages/DashboardAdmin';
import DashboardInvestigator from './pages/DashboardInvestigator';

function App() {
  const { isAuthenticated, usuario, token, restaurarSesion } = useAuthStore();
  const [sessionRestored, setSessionRestored] = useState(false);

  useEffect(() => {
    restaurarSesion();
    setSessionRestored(true);
  }, []);

  if (!sessionRestored) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-investigation-bg">
        <div className="font-mono text-cyan-300">INICIALIZANDO PRISMA...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (usuario?.rol === 'admin') {
    return <DashboardAdmin />;
  }

  return <DashboardInvestigator token={token} usuario={usuario} />;
}

export default App;

