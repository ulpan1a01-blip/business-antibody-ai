import { useEffect, useState } from 'react';
import Landing from './components/Landing.jsx';
import Auth from './components/Auth.jsx';
import Workspace from './components/Workspace.jsx';
import { api, setToken } from './api.js';

// Три экрана: лендинг → вход → рабочая область. Демо-режим открывает рабочую область без регистрации.
export default function App() {
  const [view, setView] = useState('landing');
  const [user, setUser] = useState(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => { // если токен уже сохранён, входим автоматически
    if (localStorage.getItem('token')) api('/me').then((u) => { setUser(u); setView('workspace'); }).catch(() => setToken(null));
  }, []);

  const exit = async () => {
    if (!demo) await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setToken(null); setUser(null); setDemo(false); setView('landing');
  };
  if (view === 'auth') return <Auth onBack={() => setView('landing')} onDone={(u) => { setUser(u); setDemo(false); setView('workspace'); }} />;
  if (view === 'workspace') return <Workspace user={user} demo={demo} onExit={exit} />;
  return <Landing onStart={() => setView('auth')} onDemo={() => { setDemo(true); setView('workspace'); }} />;
}
