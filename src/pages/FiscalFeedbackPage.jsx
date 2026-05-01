import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FiArrowLeft, FiMessageSquare } from 'react-icons/fi';

const API_URL = import.meta.env.DEV ? 'http://localhost:5000/api' : (import.meta.env.VITE_API_URL || '/api');

function FiscalFeedbackPage({ token, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await axios.get(`${API_URL}/investigacion-feedback/justificaciones`, {
          headers: authHeaders,
        });
        setItems(response.data || []);
      } catch (requestError) {
        console.error('Error cargando justificaciones de feedback:', requestError);
        setError('No fue posible cargar las justificaciones del feedback.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authHeaders]);

  return (
    <div className="min-h-screen bg-investigation-bg text-slate-100">
      <header className="border-b border-cyan-500/20 bg-panel-dark px-8 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-bold tracking-[0.2em] text-slate-100">FEEDBACK FISCAL</h1>
            <p className="font-mono text-xs text-cyan-300/70">Justificaciones no vacías por conexión</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg border border-slate-500/30 px-4 py-2 font-mono text-sm text-slate-300 transition hover:bg-slate-700/40"
          >
            <FiArrowLeft size={16} />
            Volver
          </button>
        </div>
      </header>

      <main className="p-8">
        {error && (
          <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="font-mono text-cyan-300">Cargando justificaciones...</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-slate-500/20 bg-slate-900/60 px-5 py-4 text-sm text-slate-300">
            No hay justificaciones registradas con texto.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={`${item.evaluacion_id}-${item.pair_key}`} className="rounded-xl border border-cyan-500/20 bg-slate-950/70 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-200">
                    Fiscal: {item.investigador_nombre}
                  </span>
                  <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                    Puntaje: {item.puntaje}%
                  </span>
                  <span className="rounded border border-slate-500/30 bg-slate-900/70 px-2 py-1">
                    Esperadas: {item.expected_total} | Trazadas: {item.user_total}
                  </span>
                </div>

                <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Conexión mencionada</p>
                  <p className="mt-1 text-sm text-amber-100">{item.pair_label || item.pair_key}</p>
                </div>

                <div className="mt-3 rounded-lg border border-slate-500/20 bg-slate-900/70 p-3">
                  <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-300">
                    <FiMessageSquare size={13} />
                    Justificación
                  </p>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default FiscalFeedbackPage;
