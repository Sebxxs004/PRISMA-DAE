import { create } from 'zustand';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const useAuthStore = create((set, get) => ({
  usuario: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      const { token, usuario } = response.data;

      set({
        token,
        usuario,
        isAuthenticated: true,
        loading: false,
      });

      localStorage.setItem('token', token);
      localStorage.setItem('usuario', JSON.stringify(usuario));

      return true;
    } catch (err) {
      const message = err.response?.data?.error || 'Error en login';
      set({ error: message, loading: false });
      return false;
    }
  },

  logout: () => {
    set({
      usuario: null,
      token: null,
      isAuthenticated: false,
    });
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  },

  restaurarSesion: () => {
    const token = localStorage.getItem('token');
    const usuarioStr = localStorage.getItem('usuario');

    if (token && usuarioStr) {
      try {
        const usuario = JSON.parse(usuarioStr);
        set({
          token,
          usuario,
          isAuthenticated: true,
        });
      } catch (e) {
        console.error('Error restaurando sesión', e);
      }
    }
  },
}));

export default useAuthStore;
