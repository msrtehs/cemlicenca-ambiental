import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('cemlicenca_token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      carregarUsuario();
    } else {
      setLoading(false);
    }
  }, []);

  async function carregarUsuario() {
    try {
      const { data } = await api.get('/auth/me');
      setUsuario(data);
    } catch {
      localStorage.removeItem('cemlicenca_token');
      delete api.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  }

  async function login(email, senha) {
    const { data } = await api.post('/auth/login', { email, senha });
    localStorage.setItem('cemlicenca_token', data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUsuario(data.usuario);
    return data;
  }

  function logout() {
    localStorage.removeItem('cemlicenca_token');
    delete api.defaults.headers.common['Authorization'];
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout, carregarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
