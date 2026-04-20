import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  FiArrowLeft,
  FiLock,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiUserPlus,
  FiUsers,
} from 'react-icons/fi';

const API_URL = import.meta.env.DEV ? 'http://localhost:5000/api' : (import.meta.env.VITE_API_URL || '/api');

const EMPTY_FORM = {
  nombre: '',
  email: '',
  password: '',
};

function InvestigatorsManagementPage({ token, onBack }) {
  const [investigators, setInvestigators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [passwordModalId, setPasswordModalId] = useState(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadInvestigators = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/admin/investigadores`, {
        headers: authHeaders,
      });
      setInvestigators(response.data || []);
    } catch (requestError) {
      console.error('Error cargando investigadores:', requestError);
      setError('No fue posible cargar los investigadores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvestigators();
  }, [authHeaders]);

  const closeCreate = () => {
    setIsCreateOpen(false);
    setForm(EMPTY_FORM);
  };

  const openPasswordModal = (investigator) => {
    setPasswordModalId(investigator.id);
    setPasswordValue('');
  };

  const closePasswordModal = () => {
    setPasswordModalId(null);
    setPasswordValue('');
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await axios.post(
        `${API_URL}/admin/investigadores`,
        {
          nombre: form.nombre,
          email: form.email,
          password: form.password,
        },
        { headers: authHeaders }
      );

      setSuccess('Investigador creado correctamente.');
      closeCreate();
      await loadInvestigators();
    } catch (requestError) {
      console.error('Error creando investigador:', requestError);
      setError(requestError.response?.data?.error || 'No fue posible crear el investigador.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    if (!passwordModalId) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await axios.patch(
        `${API_URL}/admin/investigadores/${passwordModalId}/password`,
        { password: passwordValue },
        { headers: authHeaders }
      );

      setSuccess('Contraseña actualizada correctamente.');
      closePasswordModal();
      await loadInvestigators();
    } catch (requestError) {
      console.error('Error actualizando contraseña:', requestError);
      setError(requestError.response?.data?.error || 'No fue posible actualizar la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  const toggleResolved = async (investigator) => {
    if (!investigator.feedback_id) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await axios.patch(
        `${API_URL}/admin/investigadores/${investigator.id}/resuelto`,
        { resuelto: !investigator.feedback_resuelto },
        { headers: authHeaders }
      );

      setSuccess(
        !investigator.feedback_resuelto
          ? 'La prueba quedó marcada como resuelta.'
          : 'La prueba quedó desbloqueada para repetirse.'
      );
      await loadInvestigators();
    } catch (requestError) {
      console.error('Error actualizando estado de resuelto:', requestError);
      setError(requestError.response?.data?.error || 'No fue posible actualizar el estado de resuelto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-investigation-bg text-slate-100">
      <header className="border-b border-cyan-500/20 bg-panel-dark px-8 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-bold tracking-[0.2em] text-slate-100">GESTION DE INVESTIGADORES</h1>
            <p className="font-mono text-xs text-cyan-300/70">Crear cuentas, cambiar contrasena y reabrir la prueba</p>
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
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-mono text-xl font-semibold tracking-[0.15em] text-slate-100">Investigadores</h2>
            <p className="mt-1 text-sm text-slate-400">Desde aqui puedes administrar acceso y estado de la prueba.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            <FiUserPlus size={15} />
            Nuevo investigador
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        {loading ? (
          <div className="font-mono text-cyan-300">Cargando investigadores...</div>
        ) : investigators.length === 0 ? (
          <div className="rounded-lg border border-slate-500/20 bg-slate-900/60 px-5 py-4 text-sm text-slate-300">
            No hay investigadores registrados.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {investigators.map((investigator) => (
              <div key={investigator.id} className="rounded-xl border border-cyan-500/20 bg-slate-950/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg text-slate-100">{investigator.nombre}</p>
                    <p className="mt-1 text-xs text-slate-400">{investigator.email}</p>
                  </div>
                  <span
                    className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                      investigator.feedback_id
                        ? investigator.feedback_resuelto
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                        : 'border-slate-500/30 bg-slate-900/70 text-slate-300'
                    }`}
                  >
                    {investigator.feedback_id ? (investigator.feedback_resuelto ? 'Resuelto' : 'Desbloqueado') : 'Sin prueba'}
                  </span>
                </div>

                <div className="mt-4 space-y-2 rounded-lg border border-slate-500/20 bg-slate-900/60 p-3 text-xs text-slate-300">
                  <p className="flex items-center gap-2">
                    <FiUsers size={13} />
                    Estado: {investigator.activo ? 'Activo' : 'Inactivo'}
                  </p>
                  <p className="flex items-center gap-2">
                    <FiShield size={13} />
                    Prueba: {investigator.feedback_id ? `Puntaje ${investigator.feedback_puntaje}%` : 'Aun no presentada'}
                  </p>
                  <p className="flex items-center gap-2">
                    <FiRefreshCw size={13} />
                    Esperadas: {investigator.feedback_expected_total || 0} | Trazadas: {investigator.feedback_user_total || 0}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openPasswordModal(investigator)}
                    className="flex items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 transition hover:bg-cyan-500/20"
                  >
                    <FiLock size={14} />
                    Cambiar contrasena
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleResolved(investigator)}
                    disabled={!investigator.feedback_id || saving}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    {investigator.feedback_id
                      ? investigator.feedback_resuelto
                        ? 'Reabrir prueba'
                        : 'Marcar resuelto'
                      : 'Sin feedback'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
          <div className="w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-slate-900/95 p-6 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-mono text-lg font-semibold tracking-[0.2em] text-emerald-200">NUEVO INVESTIGADOR</h3>
              <button
                type="button"
                onClick={closeCreate}
                className="rounded border border-slate-500/30 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700/40"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <input
                type="text"
                value={form.nombre}
                onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                placeholder="Nombre completo"
                className="w-full rounded-lg border border-slate-500/20 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 outline-none"
              />
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="Correo electronico"
                className="w-full rounded-lg border border-slate-500/20 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 outline-none"
              />
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Contrasena temporal"
                className="w-full rounded-lg border border-slate-500/20 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 outline-none"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeCreate}
                  className="rounded-lg border border-slate-500/30 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/40"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60"
                >
                  <FiPlus size={14} />
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
          <div className="w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-6 shadow-[0_0_40px_rgba(8,145,178,0.2)]">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-mono text-lg font-semibold tracking-[0.2em] text-cyan-200">CAMBIAR CONTRASENA</h3>
              <button
                type="button"
                onClick={closePasswordModal}
                className="rounded border border-slate-500/30 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700/40"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <input
                type="password"
                value={passwordValue}
                onChange={(event) => setPasswordValue(event.target.value)}
                placeholder="Nueva contrasena"
                className="w-full rounded-lg border border-slate-500/20 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 outline-none"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="rounded-lg border border-slate-500/30 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/40"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-60"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvestigatorsManagementPage;
