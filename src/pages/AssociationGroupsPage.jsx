import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FiArrowLeft, FiCheckCircle, FiLayers, FiPlus, FiTrash2, FiUsers, FiX } from 'react-icons/fi';

const API_URL = import.meta.env.DEV ? 'http://localhost:5000/api' : (import.meta.env.VITE_API_URL || '/api');

function AssociationGroupsPage({ token, usuario, onBack }) {
  const [carpetas, setCarpetas] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingCarpetas, setLoadingCarpetas] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [groupForm, setGroupForm] = useState({
    nombre: '',
    patron_criminal: '',
    justificacion_general: '',
  });
  const [selectedCaseIds, setSelectedCaseIds] = useState([]);
  const [pairJustifications, setPairJustifications] = useState({});
  const [pairTypes, setPairTypes] = useState({});
  const [exclusionJustifications, setExclusionJustifications] = useState({});

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  useEffect(() => {
    cargarCarpetas();
    cargarGrupos();
  }, []);

  const cargarCarpetas = async () => {
    setLoadingCarpetas(true);
    try {
      const response = await axios.get(`${API_URL}/carpetas`, {
        headers: authHeaders,
      });
      setCarpetas(response.data);
    } catch (requestError) {
      console.error('Error cargando casos:', requestError);
      setError('No fue posible cargar los casos.');
    } finally {
      setLoadingCarpetas(false);
    }
  };

  const cargarGrupos = async () => {
    setLoadingGroups(true);
    try {
      const response = await axios.get(`${API_URL}/grupos-asociacion`, {
        headers: authHeaders,
      });
      setGroups(response.data);
    } catch (requestError) {
      console.error('Error cargando grupos:', requestError);
      setError('No fue posible cargar los grupos de asociación.');
    } finally {
      setLoadingGroups(false);
    }
  };

  const toggleCaseSelection = (caseId) => {
    setSelectedCaseIds((current) => {
      if (current.includes(caseId)) {
        return current.filter((id) => id !== caseId);
      }
      return [...current, caseId];
    });
  };

  const selectedCases = useMemo(
    () => carpetas.filter((carpeta) => selectedCaseIds.includes(carpeta.id)),
    [carpetas, selectedCaseIds]
  );
  const unselectedCases = useMemo(
    () => carpetas.filter((carpeta) => !selectedCaseIds.includes(carpeta.id)),
    [carpetas, selectedCaseIds]
  );

  const pairList = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < selectedCases.length; i += 1) {
      for (let j = i + 1; j < selectedCases.length; j += 1) {
        const first = selectedCases[i];
        const second = selectedCases[j];
        const key = [first.id, second.id].sort().join('__');
        pairs.push({
          key,
          carpeta_a_id: first.id,
          carpeta_b_id: second.id,
          carpeta_a_nombre: first.nombre,
          carpeta_b_nombre: second.nombre,
        });
      }
    }
    return pairs;
  }, [selectedCases]);

  useEffect(() => {
    setPairJustifications((current) => {
      const next = {};
      for (const pair of pairList) {
        next[pair.key] = current[pair.key] || '';
      }
      return next;
    });
    setPairTypes((current) => {
      const next = {};
      for (const pair of pairList) {
        next[pair.key] = current[pair.key] || 'modalidad';
      }
      return next;
    });
  }, [pairList]);

  useEffect(() => {
    setExclusionJustifications((current) => {
      const next = {};
      for (const caseItem of unselectedCases) {
        next[caseItem.id] = current[caseItem.id] || '';
      }
      return next;
    });
  }, [unselectedCases]);

  const updatePairJustification = (pairKey, value) => {
    setPairJustifications((current) => ({
      ...current,
      [pairKey]: value,
    }));
  };

  const updatePairType = (pairKey, value) => {
    setPairTypes((current) => ({
      ...current,
      [pairKey]: value,
    }));
  };

  const updateExclusionJustification = (caseId, value) => {
    setExclusionJustifications((current) => ({
      ...current,
      [caseId]: value,
    }));
  };

  const resetForm = () => {
    setGroupForm({ nombre: '', patron_criminal: '', justificacion_general: '' });
    setSelectedCaseIds([]);
    setPairJustifications({});
    setPairTypes({});
    setExclusionJustifications({});
  };

  const guardarGrupo = async () => {
    setError('');
    setSuccess('');

    if (selectedCaseIds.length < 2) {
      setError('Selecciona al menos dos casos para crear un grupo.');
      return;
    }

    if (groupForm.nombre.trim().length < 3) {
      setError('El nombre del grupo debe tener al menos 3 caracteres.');
      return;
    }

    if (!groupForm.patron_criminal || groupForm.patron_criminal.trim() === '') {
      setError('Debe seleccionar o indicar el patrón criminal principal.');
      return;
    }

    if (groupForm.justificacion_general.trim().length < 15) {
      setError('La justificación general debe ser más detallada.');
      return;
    }

    for (const pair of pairList) {
      const justification = (pairJustifications[pair.key] || '').trim();
      if (justification.length < 15) {
        setError(`Falta una justificación suficiente para ${pair.carpeta_a_nombre} y ${pair.carpeta_b_nombre}.`);
        return;
      }
    }

    for (const caseItem of unselectedCases) {
      const justification = (exclusionJustifications[caseItem.id] || '').trim();
      if (justification.length < 15) {
        setError(`Debes justificar por qué ${caseItem.nombre} no pertenece a este grupo.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        nombre: groupForm.nombre.trim(),
        patron_criminal: groupForm.patron_criminal.trim(),
        justificacion_general: groupForm.justificacion_general.trim(),
        usuario_id: usuario.id,
        casos: selectedCaseIds.map((caseId) => ({ carpeta_id: caseId })),
        relaciones: pairList.map((pair) => ({
          carpeta_a_id: pair.carpeta_a_id,
          carpeta_b_id: pair.carpeta_b_id,
          relation_type: pairTypes[pair.key] || 'modalidad',
          justificacion: pairJustifications[pair.key].trim(),
        })),
        exclusiones: unselectedCases.map((caseItem) => ({
          carpeta_id: caseItem.id,
          justificacion_no_relacion: (exclusionJustifications[caseItem.id] || '').trim(),
        })),
      };

      const response = await axios.post(`${API_URL}/grupos-asociacion`, payload, {
        headers: authHeaders,
      });

      setSuccess(response.data.razon || 'Grupo creado correctamente.');
      resetForm();
      await cargarGrupos();
    } catch (requestError) {
      console.error('Error guardando grupo:', requestError);
      setError(requestError.response?.data?.razon || 'No se pudo guardar el grupo.');
    } finally {
      setSaving(false);
    }
  };

  const eliminarGrupo = async (groupId) => {
    if (!window.confirm('¿Eliminar este grupo de asociación?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/grupos-asociacion/${groupId}`, {
        headers: authHeaders,
      });
      await cargarGrupos();
    } catch (requestError) {
      console.error('Error eliminando grupo:', requestError);
      setError('No se pudo eliminar el grupo.');
    }
  };

  return (
    <div className="min-h-screen bg-investigation-bg px-6 py-6 text-slate-100">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Módulo de asociación</p>
          <h1 className="mt-2 font-mono text-2xl font-semibold tracking-[0.2em] text-slate-100">
            Grupos de Asociación
          </h1>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-slate-500/30 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700/40"
        >
          <FiArrowLeft size={16} />
          Volver a casos
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          {success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-cyan-500/20 bg-slate-950/50 p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-mono text-lg font-semibold tracking-[0.15em] text-cyan-200">
                Crear grupo
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Selecciona varios casos. El sistema generará relaciones entre todos los pares del grupo.
              </p>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
              {selectedCaseIds.length} casos seleccionados
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
                Nombre del grupo
              </label>
              <input
                type="text"
                value={groupForm.nombre}
                onChange={(event) => setGroupForm((current) => ({ ...current, nombre: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-cyan-500/20 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
                placeholder="Ej: Grupo SERFINANZA"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
                Patrón criminal principal / Ideario delictivo
              </label>
              <select
                value={groupForm.patron_criminal}
                onChange={(event) => setGroupForm((current) => ({ ...current, patron_criminal: event.target.value }))}
                className="mt-2 w-full rounded-lg border border-cyan-500/20 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
              >
                <option value="">-- Selecciona el patrón criminal --</option>
                <option value="Mismo modus operandi">Mismo modus operandi</option>
                <option value="Reclutamiento">Reclutamiento</option>
                <option value="Lavado de activos">Lavado de activos</option>
                <option value="Falsificación documental">Falsificación documental</option>
                <option value="Extorsión sistemática">Extorsión sistemática</option>
                <option value="Concierto para delinquir">Concierto para delinquir</option>
                <option value="Múltiples factores asociados">Múltiples factores asociados</option>
              </select>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
                Justificación general del grupo
              </label>
              <textarea
                rows="3"
                value={groupForm.justificacion_general}
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, justificacion_general: event.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-cyan-500/20 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
                placeholder="Explica por qué estos casos forman parte del mismo grupo de asociación..."
              />
            </div>

            <div className="rounded-xl border border-slate-500/20 bg-slate-900/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-mono text-sm font-semibold tracking-[0.15em] text-cyan-200">
                  Casos disponibles
                </h3>
                {loadingCarpetas && <span className="text-xs text-slate-400">Cargando...</span>}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {carpetas.map((carpeta) => {
                  const selected = selectedCaseIds.includes(carpeta.id);
                  return (
                    <button
                      type="button"
                      key={carpeta.id}
                      onClick={() => toggleCaseSelection(carpeta.id)}
                      className={`rounded-lg border p-3 text-left transition ${
                        selected
                          ? 'border-cyan-400/60 bg-cyan-500/10'
                          : 'border-slate-500/20 bg-slate-950/40 hover:border-cyan-400/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-sm font-semibold text-slate-100">{carpeta.nombre}</p>
                          <p className="mt-1 text-xs text-slate-400 line-clamp-2">{carpeta.descripcion}</p>
                        </div>
                        {selected ? <FiCheckCircle className="mt-0.5 text-cyan-300" size={16} /> : <FiUsers className="mt-0.5 text-slate-500" size={16} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-slate-900/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-mono text-sm font-semibold tracking-[0.15em] text-blue-200">
                  Relaciones por par
                </h3>
                <span className="text-xs text-slate-400">{pairList.length} pares</span>
              </div>

              {pairList.length === 0 ? (
                <p className="text-sm text-slate-400">Selecciona al menos 2 casos para generar las relaciones.</p>
              ) : (
                <div className="space-y-3">
                  {pairList.map((pair) => (
                    <div key={pair.key} className="rounded-lg border border-slate-500/20 bg-slate-950/50 p-3">
                      <p className="text-sm font-semibold text-slate-100">
                        {pair.carpeta_a_nombre} <span className="text-cyan-300">↔</span> {pair.carpeta_b_nombre}
                      </p>
                      <div className="mt-2">
                        <label className="block text-[11px] uppercase tracking-[0.2em] text-slate-400">
                          Tipo de relación
                        </label>
                        <select
                          value={pairTypes[pair.key] || 'modalidad'}
                          onChange={(event) => updatePairType(pair.key, event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-500/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-300"
                        >
                          <option value="modalidad">Modalidad</option>
                          <option value="patrones">Patrón</option>
                        </select>
                      </div>
                      <textarea
                        rows="2"
                        value={pairJustifications[pair.key] || ''}
                        onChange={(event) => updatePairJustification(pair.key, event.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-500/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-300"
                        placeholder="Justifica por qué estos dos casos se relacionan..."
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-orange-500/20 bg-slate-900/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-mono text-sm font-semibold tracking-[0.15em] text-orange-200">
                  Casos no seleccionados (justificación de no relación)
                </h3>
                <span className="text-xs text-slate-400">{unselectedCases.length} casos</span>
              </div>

              {unselectedCases.length === 0 ? (
                <p className="text-sm text-slate-400">Todos los casos están dentro del grupo.</p>
              ) : (
                <div className="space-y-3">
                  {unselectedCases.map((caseItem) => (
                    <div key={caseItem.id} className="rounded-lg border border-slate-500/20 bg-slate-950/50 p-3">
                      <p className="text-sm font-semibold text-slate-100">{caseItem.nombre}</p>
                      <textarea
                        rows="2"
                        value={exclusionJustifications[caseItem.id] || ''}
                        onChange={(event) => updateExclusionJustification(caseItem.id, event.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-500/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-orange-300"
                        placeholder="Explica por qué este caso no tiene relación con este grupo..."
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-500/30 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700/40"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={guardarGrupo}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition disabled:opacity-60 hover:bg-cyan-500/20"
              >
                <FiPlus size={16} />
                {saving ? 'Guardando...' : 'Crear grupo'}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-500/20 bg-slate-950/50 p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-mono text-lg font-semibold tracking-[0.15em] text-slate-100">
                Grupos creados
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Aquí se muestran los grupos ya guardados y su cobertura relacional.
              </p>
            </div>
            {loadingGroups && <span className="text-xs text-slate-400">Actualizando...</span>}
          </div>

          <div className="space-y-3">
            {groups.length === 0 ? (
              <div className="rounded-lg border border-slate-500/20 bg-slate-900/50 p-4 text-sm text-slate-400">
                Todavía no hay grupos de asociación.
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.id} className="rounded-lg border border-slate-500/20 bg-slate-900/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-slate-100">{group.nombre}</p>
                      {group.patron_criminal && (
                        <p className="mt-1 max-w-fit rounded border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-purple-300 uppercase tracking-wider">
                          Patrón / Ideario: {group.patron_criminal}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-slate-400">{group.justificacion_general}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarGrupo(group.id)}
                      className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      <FiTrash2 size={12} />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-cyan-200">
                    <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1">
                      {group.cantidad_casos} casos
                    </span>
                    <span className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-1">
                      {group.cantidad_relaciones} relaciones
                    </span>
                    <span className="rounded border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-orange-200">
                      {group.cantidad_exclusiones || 0} exclusiones justificadas
                    </span>
                    <span className="rounded border border-slate-500/20 bg-slate-700/40 px-2 py-1 text-slate-200">
                      {group.created_by_nombre || 'Sin autor'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-cyan-500/20 bg-slate-950/50 p-5">
        <h2 className="flex items-center gap-2 font-mono text-lg font-semibold tracking-[0.15em] text-cyan-200">
          <FiLayers size={18} />
          Regla de propagación
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
          Si un grupo contiene varios casos, el sistema guarda todas las relaciones por pares. Eso permite que la relación se propague de forma transitiva: si el Caso 1 se relaciona con el Caso 2, y el Caso 2 con el Caso 4 dentro de uno o varios grupos, el grafo considera que el Caso 1 y el Caso 4 también están relacionados.
        </p>
      </section>
    </div>
  );
}

export default AssociationGroupsPage;
