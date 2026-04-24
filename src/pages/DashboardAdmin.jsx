import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  FiAlertTriangle,
  FiDownload,
  FiEdit2,
  FiEye,
  FiFile,
  FiFolder,
  FiLink2,
  FiMinus,
  FiPlus,
  FiSettings,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import useAuthStore from '../store/useAuthStore';
import AssociationGroupsPage from './AssociationGroupsPage';
import InvestigatorFeedbackPage from './InvestigatorFeedbackPage';
import InvestigatorsManagementPage from './InvestigatorsManagementPage';

const API_URL = import.meta.env.DEV ? 'http://localhost:5000/api' : (import.meta.env.VITE_API_URL || '/api');
const EMPTY_DOCUMENT = { nombre: '', descripcion: '', archivo_url: '' };
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_DOCUMENT_SIZE_BYTES = 40 * 1024 * 1024;

function DashboardAdmin() {
  const { usuario, token, logout } = useAuthStore();

  const [carpetas, setCarpetas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingCase, setSavingCase] = useState(false);
  const [deletingCaseId, setDeletingCaseId] = useState(null);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(null);

  const [modalData, setModalData] = useState({
    nombre: '',
    descripcion: '',
    imagen_url: '',
    tipo_delito: '',
    fecha_caso: '',
    victima: '',
    victimario: '',
    zona_territorial: '',
    actores_involucrados: '',
    es_autor_intelectual: false,
    es_zona_operacion: false,
    documentos: [{ ...EMPTY_DOCUMENT }],
  });

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configData, setConfigData] = useState({ tiempo_limite_minutos: 10 });
  const [savingConfig, setSavingConfig] = useState(false);

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [caseViewData, setCaseViewData] = useState(null);
  const [viewerDocumentos, setViewerDocumentos] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [connectionSourceCase, setConnectionSourceCase] = useState(null);
  const [existingConnections, setExistingConnections] = useState([]);
  const [connectionSaving, setConnectionSaving] = useState(false);
  const [connectionData, setConnectionData] = useState({
    carpeta_destino_id: '',
    tipo: 'modalidad',
    razonamiento: '',
  });
  const [connectionFeedback, setConnectionFeedback] = useState(null);
  const [activeSection, setActiveSection] = useState('casos');

  useEffect(() => {
    cargarCarpetas();
    cargarConfiguracion();
  }, []);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const cargarConfiguracion = async () => {
    try {
      const response = await axios.get(`${API_URL}/configuracion`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data) {
        setConfigData(response.data);
      }
    } catch (err) {
      console.error('Error cargando configuración:', err);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const response = await axios.put(`${API_URL}/configuracion`, configData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConfigData(response.data);
      setIsConfigModalOpen(false);
    } catch (err) {
      console.error('Error guardando configuración:', err);
      setError('No fue posible guardar la configuración');
    } finally {
      setSavingConfig(false);
    }
  };

  const getPdfViewerSrc = (archivoUrl) => {
    if (!archivoUrl) return null;

    const normalized = String(archivoUrl).trim();
    if (normalized.startsWith('data:application/pdf')) {
      return normalized;
    }

    // Only allow HTTP/HTTPS URLs that explicitly point to a PDF file.
    const isHttp = /^https?:\/\//i.test(normalized);
    const isPdfUrl = /\.pdf($|\?|#)/i.test(normalized);
    if (isHttp && isPdfUrl) {
      return normalized;
    }

    return null;
  };

  const isPdfFile = (archivoUrl) => getPdfViewerSrc(archivoUrl) !== null;

  const cargarCarpetas = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/carpetas`, {
        headers: authHeaders,
      });
      setCarpetas(response.data);
    } catch (requestError) {
      console.error('Error cargando carpetas:', requestError);
      setError('No fue posible cargar los casos.');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setModalData({
      nombre: '',
      descripcion: '',
      imagen_url: '',
      tipo_delito: '',
      fecha_caso: '',
      victima: '',
      victimario: '',
      zona_territorial: '',
      actores_involucrados: '',
      es_autor_intelectual: false,
      es_zona_operacion: false,
      documentos: [{ ...EMPTY_DOCUMENT }],
    });
    setIsEditMode(false);
    setSelectedCaseId(null);
    setSavingCase(false);
  };

  const openCreateModal = () => {
    setError('');
    resetModal();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetModal();
  };

  const openEditModal = async (carpeta) => {
    setError('');
    setSavingCase(true);
    try {
      const response = await axios.get(`${API_URL}/documentos/carpeta/${carpeta.id}`, {
        headers: authHeaders,
      });

      const documentos = response.data.length
        ? response.data.map((doc) => ({
            id: doc.id,
            nombre: doc.nombre || '',
            descripcion: doc.descripcion || '',
            archivo_url: doc.archivo_url || '',
          }))
        : [{ ...EMPTY_DOCUMENT }];

      setModalData({
        nombre: carpeta.nombre || '',
        descripcion: carpeta.descripcion || '',
        imagen_url: carpeta.imagen_url || '',
        tipo_delito: carpeta.tipo_delito || '',
        fecha_caso: carpeta.fecha_caso ? String(carpeta.fecha_caso).slice(0, 10) : '',
        victima: carpeta.victima || '',
        victimario: carpeta.victimario || '',
        zona_territorial: carpeta.zona_territorial || '',
        actores_involucrados: Array.isArray(carpeta.actores_involucrados)
          ? carpeta.actores_involucrados.join(', ')
          : (carpeta.actores_involucrados || ''),
        es_autor_intelectual: Boolean(carpeta.es_autor_intelectual),
        es_zona_operacion: Boolean(carpeta.es_zona_operacion),
        documentos,
      });
      setSelectedCaseId(carpeta.id);
      setIsEditMode(true);
      setIsModalOpen(true);
    } catch (requestError) {
      console.error('Error cargando caso para edición:', requestError);
      setError('No se pudo cargar el caso para edición.');
    } finally {
      setSavingCase(false);
    }
  };

  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen en el caso.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError('La imagen excede el tamaño máximo permitido (15 MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setModalData((current) => ({
        ...current,
        imagen_url: String(reader.result),
      }));
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleDropImage = (event) => {
    event.preventDefault();
    handleImageFile(event.dataTransfer.files?.[0]);
  };

  const handlePasteImage = (event) => {
    const items = event.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        handleImageFile(item.getAsFile());
        break;
      }
    }
  };

  const handleDocumentFile = (index, file) => {
    if (!file) {
      return;
    }

    if (!file.type.includes('pdf')) {
      setError('Solo se permiten archivos PDF en documentos.');
      return;
    }

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setError('El documento excede el tamaño máximo permitido (40 MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const encodedFile = String(reader.result);
      setModalData((current) => {
        const updated = [...current.documentos];
        const currentDoc = updated[index] || { ...EMPTY_DOCUMENT };
        updated[index] = {
          ...currentDoc,
          archivo_url: encodedFile,
          nombre: currentDoc.nombre?.trim() ? currentDoc.nombre : file.name,
        };
        return {
          ...current,
          documentos: updated,
        };
      });
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleDropDocument = (index, event) => {
    event.preventDefault();
    handleDocumentFile(index, event.dataTransfer.files?.[0]);
  };

  const updateDocumentField = (index, field, value) => {
    setModalData((current) => {
      const updated = [...current.documentos];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return {
        ...current,
        documentos: updated,
      };
    });
  };

  const addDocumentField = () => {
    setModalData((current) => ({
      ...current,
      documentos: [...current.documentos, { ...EMPTY_DOCUMENT }],
    }));
  };

  const removeDocumentField = (index) => {
    setModalData((current) => {
      if (current.documentos.length === 1) {
        return {
          ...current,
          documentos: [{ ...EMPTY_DOCUMENT }],
        };
      }
      return {
        ...current,
        documentos: current.documentos.filter((_, i) => i !== index),
      };
    });
  };

  const syncDocumentos = async (carpetaId, documentos) => {
    if (isEditMode) {
      const existentes = await axios.get(`${API_URL}/documentos/carpeta/${carpetaId}`, {
        headers: authHeaders,
      });

      for (const doc of existentes.data) {
        await axios.delete(`${API_URL}/documentos/${doc.id}`, {
          headers: authHeaders,
        });
      }
    }

    const validDocuments = documentos
      .map((doc) => ({
        nombre: doc.nombre.trim(),
        descripcion: doc.descripcion.trim(),
        archivo_url: doc.archivo_url?.trim() || null,
      }))
      .filter((doc) => doc.nombre.length > 0);

    for (const doc of validDocuments) {
      await axios.post(
        `${API_URL}/documentos`,
        {
          carpeta_id: carpetaId,
          nombre: doc.nombre,
          descripcion: doc.descripcion || null,
          archivo_url: doc.archivo_url,
          usuario_id: usuario.id,
        },
        {
          headers: authHeaders,
        }
      );
    }
  };

  const handleSubmitCase = async (event) => {
    event.preventDefault();
    setSavingCase(true);
    setError('');

    try {
      let carpetaId = selectedCaseId;

      if (isEditMode) {
        await axios.put(
          `${API_URL}/carpetas/${selectedCaseId}`,
          {
            nombre: modalData.nombre,
            descripcion: modalData.descripcion,
            imagen_url: modalData.imagen_url,
            tipo_delito: modalData.tipo_delito,
            fecha_caso: modalData.fecha_caso || null,
            victima: modalData.victima,
            victimario: modalData.victimario,
            zona_territorial: modalData.zona_territorial,
            actores_involucrados: modalData.actores_involucrados,
            es_autor_intelectual: modalData.es_autor_intelectual,
            es_zona_operacion: modalData.es_zona_operacion,
          },
          {
            headers: authHeaders,
          }
        );
      } else {
        const response = await axios.post(
          `${API_URL}/carpetas`,
          {
            nombre: modalData.nombre,
            descripcion: modalData.descripcion,
            imagen_url: modalData.imagen_url,
            tipo_delito: modalData.tipo_delito,
            fecha_caso: modalData.fecha_caso || null,
            victima: modalData.victima,
            victimario: modalData.victimario,
            zona_territorial: modalData.zona_territorial,
            actores_involucrados: modalData.actores_involucrados,
            es_autor_intelectual: modalData.es_autor_intelectual,
            es_zona_operacion: modalData.es_zona_operacion,
            usuario_id: usuario.id,
          },
          {
            headers: authHeaders,
          }
        );
        carpetaId = response.data.id;
      }

      await syncDocumentos(carpetaId, modalData.documentos);
      closeModal();
      await cargarCarpetas();
    } catch (requestError) {
      console.error('Error guardando caso:', requestError);
      setError('No fue posible guardar el caso.');
    } finally {
      setSavingCase(false);
    }
  };

  const handleDeleteCase = async (caseId) => {
    if (!window.confirm('Esta acción eliminará el caso y sus documentos. ¿Deseas continuar?')) {
      return;
    }

    setDeletingCaseId(caseId);
    setError('');
    try {
      await axios.delete(`${API_URL}/carpetas/${caseId}`, {
        headers: authHeaders,
      });
      await cargarCarpetas();
    } catch (requestError) {
      console.error('Error eliminando caso:', requestError);
      setError('No fue posible eliminar el caso.');
    } finally {
      setDeletingCaseId(null);
    }
  };

  const openViewerModal = async (carpeta) => {
    setIsViewerOpen(true);
    setViewerLoading(true);
    setCaseViewData(carpeta);
    setSelectedDocument(null);
    try {
      const response = await axios.get(`${API_URL}/documentos/carpeta/${carpeta.id}`, {
        headers: authHeaders,
      });
      setViewerDocumentos(response.data);
    } catch (requestError) {
      console.error('Error cargando documentos para visor:', requestError);
      setError('No se pudieron cargar los documentos.');
    } finally {
      setViewerLoading(false);
    }
  };

  const closeViewerModal = () => {
    setIsViewerOpen(false);
    setViewerDocumentos([]);
    setSelectedDocument(null);
    setCaseViewData(null);
  };

  const downloadDocument = (pdf) => {
    const link = document.createElement('a');
    link.href = pdf.archivo_url;
    link.download = pdf.nombre;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cargarConexiones = async (caseId) => {
    try {
      const response = await axios.get(`${API_URL}/conexiones/carpeta/${caseId}`, {
        headers: authHeaders,
      });
      setExistingConnections(response.data);
    } catch (requestError) {
      console.error('Error cargando conexiones:', requestError);
      setExistingConnections([]);
    }
  };

  const openConnectionModal = async (carpeta) => {
    setConnectionSourceCase(carpeta);
    setSelectedCaseId(carpeta.id);
    setConnectionData({ carpeta_destino_id: '', tipo: 'modalidad', razonamiento: '' });
    setConnectionFeedback(null);
    setIsConnectionModalOpen(true);
    await cargarConexiones(carpeta.id);
  };

  const closeConnectionModal = () => {
    setIsConnectionModalOpen(false);
    setConnectionSourceCase(null);
    setConnectionFeedback(null);
    setExistingConnections([]);
    setConnectionData({ carpeta_destino_id: '', tipo: 'modalidad', razonamiento: '' });
  };

  const crearConexion = async () => {
    if (!connectionData.carpeta_destino_id) {
      setConnectionFeedback({ valido: false, razon: 'Selecciona un caso destino para conectar.' });
      return;
    }

    setConnectionSaving(true);
    setConnectionFeedback(null);

    try {
      const response = await axios.post(
        `${API_URL}/conexiones`,
        {
          carpeta_origen_id: selectedCaseId,
          carpeta_destino_id: connectionData.carpeta_destino_id,
          tipo: connectionData.tipo,
          razonamiento: connectionData.razonamiento,
          usuario_id: usuario.id,
        },
        {
          headers: authHeaders,
        }
      );

      setConnectionFeedback({
        valido: true,
        razon: response.data.razon || 'Conexión creada correctamente.',
      });
      await cargarConexiones(selectedCaseId);
    } catch (requestError) {
      setConnectionFeedback({
        valido: false,
        razon:
          requestError.response?.data?.razon ||
          requestError.response?.data?.error ||
          'No se pudo crear la conexión.',
      });
    } finally {
      setConnectionSaving(false);
    }
  };

  const eliminarConexion = async (connectionId) => {
    try {
      await axios.delete(`${API_URL}/conexiones/${connectionId}`, {
        headers: authHeaders,
      });
      await cargarConexiones(selectedCaseId);
    } catch (requestError) {
      console.error('Error eliminando conexión:', requestError);
      setError('No se pudo eliminar la conexión.');
    }
  };

  const destinationOptions = carpetas.filter((carpeta) => carpeta.id !== selectedCaseId);

  if (activeSection === 'grupos') {
    return (
      <AssociationGroupsPage
        token={token}
        usuario={usuario}
        onBack={() => setActiveSection('casos')}
      />
    );
  }

  if (activeSection === 'feedback') {
    return (
      <InvestigatorFeedbackPage
        token={token}
        onBack={() => setActiveSection('casos')}
      />
    );
  }

  if (activeSection === 'investigadores') {
    return (
      <InvestigatorsManagementPage
        token={token}
        onBack={() => setActiveSection('casos')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-investigation-bg text-slate-100">
      <header className="border-b border-cyan-500/20 bg-panel-dark px-8 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-2xl font-bold tracking-[0.2em] text-slate-100">PRISMA DAE</h1>
            <p className="font-mono text-xs text-cyan-300/70">Bienvenido {usuario?.nombre}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSection('grupos')}
              className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 font-mono text-sm text-cyan-200 transition hover:bg-cyan-500/20"
            >
              Grupos de asociación
            </button>
            <button
              onClick={() => setActiveSection('feedback')}
              className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2 font-mono text-sm text-amber-200 transition hover:bg-amber-500/20"
            >
              Feedback investigador
            </button>
            <button
              onClick={() => setActiveSection('investigadores')}
              className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 font-mono text-sm text-emerald-200 transition hover:bg-emerald-500/20"
            >
              Investigadores
            </button>
            <button
              onClick={logout}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 font-mono text-sm text-red-300 transition hover:bg-red-500/20"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="p-8">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xl font-semibold tracking-[0.15em] text-slate-100">Gestión de Casos</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setIsConfigModalOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-slate-500/30 px-4 py-2 font-mono text-sm font-semibold text-slate-200 transition hover:bg-slate-700/40"
              >
                <FiSettings size={16} />
                Configuración
              </button>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 font-mono text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                <FiPlus size={16} />
                Nuevo Caso
              </button>
            </div>
          </div>

        {error && (
          <div className="mb-6 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="font-mono text-cyan-300">Cargando casos...</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {carpetas.map((carpeta) => (
              <div
                key={carpeta.id}
                className="rounded-lg border border-cyan-500/20 bg-slate-950/50 p-6 backdrop-blur-sm transition hover:border-cyan-400/40"
              >
                {carpeta.imagen_url && (
                  <img src={carpeta.imagen_url} alt={carpeta.nombre} className="mb-4 h-40 w-full rounded-lg object-cover" />
                )}
                <h3 className="font-mono text-lg font-semibold text-slate-100">{carpeta.nombre}</h3>
                <p className="mt-2 text-sm text-slate-300/70">{carpeta.descripcion}</p>
                <div className="mt-3" />
                <div className="mt-4 space-y-3">
                  <span className="block text-xs text-cyan-300/60">{carpeta.cantidad_documentos} documentos</span>
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                    <button
                      onClick={() => openViewerModal(carpeta)}
                      className="flex w-full min-w-0 items-center justify-center gap-1 rounded border border-green-500/20 px-2 py-1 font-mono text-xs text-green-200 transition hover:bg-green-500/10"
                    >
                      <FiEye size={14} />
                      Panorama
                    </button>
                    <button
                      onClick={() => openEditModal(carpeta)}
                      className="flex w-full min-w-0 items-center justify-center gap-1 rounded border border-cyan-500/20 px-2 py-1 font-mono text-xs text-cyan-200 transition hover:bg-cyan-500/10"
                    >
                      <FiEdit2 size={14} />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteCase(carpeta.id)}
                      disabled={deletingCaseId === carpeta.id}
                      className="flex w-full min-w-0 items-center justify-center gap-1 rounded border border-red-500/30 px-2 py-1 font-mono text-xs text-red-300 transition disabled:opacity-50 hover:bg-red-500/10"
                    >
                      <FiTrash2 size={14} />
                      {deletingCaseId === carpeta.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-orange-500/40 bg-slate-800/95 p-6 shadow-[0_0_40px_rgba(255,107,0,0.25)] backdrop-blur-lg">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="font-mono text-lg font-semibold tracking-[0.2em] text-orange-200">
                  {isEditMode ? 'MODIFICAR CASO' : 'CREAR CASO'}
                </h3>
                <button
                  onClick={closeModal}
                  className="flex items-center gap-1 rounded border border-slate-500/30 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700/40"
                >
                  <FiX size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitCase} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                    Nombre del Caso
                  </label>
                  <input
                    type="text"
                    value={modalData.nombre}
                    onChange={(event) => setModalData((current) => ({ ...current, nombre: event.target.value }))}
                    required
                    className="mt-2 w-full rounded-lg border border-orange-400/30 bg-slate-900/80 px-4 py-2 font-mono text-sm text-slate-100 outline-none focus:border-orange-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                    Descripción
                  </label>
                  <textarea
                    value={modalData.descripcion}
                    onChange={(event) => setModalData((current) => ({ ...current, descripcion: event.target.value }))}
                    rows="3"
                    className="mt-2 w-full rounded-lg border border-orange-400/30 bg-slate-900/80 px-4 py-2 font-mono text-sm text-slate-100 outline-none focus:border-orange-300"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                      Tipo de delito
                    </label>
                    <input
                      type="text"
                      value={modalData.tipo_delito}
                      onChange={(event) => setModalData((current) => ({ ...current, tipo_delito: event.target.value }))}
                      placeholder="Ej: Concierto para delinquir"
                      className="mt-2 w-full rounded-lg border border-orange-400/30 bg-slate-900/80 px-4 py-2 font-mono text-sm text-slate-100 outline-none focus:border-orange-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                      Fecha del caso
                    </label>
                    <input
                      type="date"
                      value={modalData.fecha_caso}
                      onChange={(event) => setModalData((current) => ({ ...current, fecha_caso: event.target.value }))}
                      className="mt-2 w-full rounded-lg border border-orange-400/30 bg-slate-900/80 px-4 py-2 font-mono text-sm text-slate-100 outline-none focus:border-orange-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                      Victima
                    </label>
                    <input
                      type="text"
                      value={modalData.victima}
                      onChange={(event) => setModalData((current) => ({ ...current, victima: event.target.value }))}
                      placeholder="Persona natural o juridica"
                      className="mt-2 w-full rounded-lg border border-orange-400/30 bg-slate-900/80 px-4 py-2 font-mono text-sm text-slate-100 outline-none focus:border-orange-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                      Victimario
                    </label>
                    <input
                      type="text"
                      value={modalData.victimario}
                      onChange={(event) => setModalData((current) => ({ ...current, victimario: event.target.value }))}
                      placeholder="Indiciado, imputado o estructura"
                      className="mt-2 w-full rounded-lg border border-orange-400/30 bg-slate-900/80 px-4 py-2 font-mono text-sm text-slate-100 outline-none focus:border-orange-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                      Zona territorial
                    </label>
                    <input
                      type="text"
                      value={modalData.zona_territorial}
                      onChange={(event) => setModalData((current) => ({ ...current, zona_territorial: event.target.value }))}
                      placeholder="Municipio, seccional o region"
                      className="mt-2 w-full rounded-lg border border-orange-400/30 bg-slate-900/80 px-4 py-2 font-mono text-sm text-slate-100 outline-none focus:border-orange-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                      Actores involucrados
                    </label>
                    <input
                      type="text"
                      value={modalData.actores_involucrados}
                      onChange={(event) => setModalData((current) => ({ ...current, actores_involucrados: event.target.value }))}
                      placeholder="Separados por coma, ej: FGN, CTI, SIJIN"
                      className="mt-2 w-full rounded-lg border border-orange-400/30 bg-slate-900/80 px-4 py-2 font-mono text-sm text-slate-100 outline-none focus:border-orange-300"
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-orange-500/20 bg-slate-900/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">Objetivos Secundarios (Modo Complejo)</p>
                  <p className="mt-1 mb-3 text-[11px] text-slate-400">Marca las opciones si esta carpeta es la respuesta a algún objetivo secundario.</p>
                  
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={modalData.es_autor_intelectual}
                        onChange={(e) => setModalData((current) => ({ ...current, es_autor_intelectual: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-500/30 bg-slate-900/80 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-sm text-slate-200">Este caso contiene al Autor Intelectual</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={modalData.es_zona_operacion}
                        onChange={(e) => setModalData((current) => ({ ...current, es_zona_operacion: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-500/30 bg-slate-900/80 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-sm text-slate-200">Este caso define la Zona de Operación</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
                    Imagen del Caso (arrastrar o pegar)
                  </label>
                  <div
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDropImage}
                    onPaste={handlePasteImage}
                    tabIndex={0}
                    className="mt-2 rounded-lg border-2 border-dashed border-orange-400/40 bg-slate-900/70 p-4 outline-none focus:border-orange-300"
                  >
                    <p className="mb-3 text-xs text-slate-300/80">Arrastra una imagen aquí o pega desde el portapapeles.</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleImageFile(event.target.files?.[0])}
                      className="mb-3 w-full text-xs text-slate-300"
                    />
                    <input
                      type="url"
                      value={modalData.imagen_url}
                      onChange={(event) => setModalData((current) => ({ ...current, imagen_url: event.target.value }))}
                      placeholder="O pega una URL de imagen"
                      className="w-full rounded-lg border border-orange-400/30 bg-slate-900/80 px-4 py-2 font-mono text-sm text-slate-100 outline-none focus:border-orange-300"
                    />
                    {modalData.imagen_url && (
                      <img src={modalData.imagen_url} alt="Preview" className="mt-4 h-44 w-full rounded-lg object-cover" />
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-cyan-500/20 bg-slate-900/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-mono text-sm font-semibold tracking-[0.2em] text-cyan-200">DOCUMENTOS PDF</h4>
                    <button
                      type="button"
                      onClick={addDocumentField}
                      className="flex items-center gap-1 rounded border border-cyan-400/30 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10"
                    >
                      <FiPlus size={14} />
                      Agregar Documento
                    </button>
                  </div>

                  <div className="space-y-4">
                    {modalData.documentos.map((doc, index) => (
                      <div key={`${index}-${doc.id || 'nuevo'}`} className="rounded-lg border border-cyan-500/20 bg-slate-950/60 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Documento {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => removeDocumentField(index)}
                            className="flex items-center gap-1 rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                          >
                            <FiMinus size={14} />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={doc.nombre}
                          onChange={(event) => updateDocumentField(index, 'nombre', event.target.value)}
                          placeholder="Nombre del documento"
                          className="mb-2 w-full rounded-lg border border-cyan-500/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
                        />
                        <textarea
                          value={doc.descripcion}
                          onChange={(event) => updateDocumentField(index, 'descripcion', event.target.value)}
                          rows="2"
                          placeholder="Descripción breve"
                          className="mb-2 w-full rounded-lg border border-cyan-500/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
                        />
                        <div
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => handleDropDocument(index, event)}
                          className="mb-2 rounded-lg border-2 border-dashed border-cyan-500/30 bg-slate-900/60 p-3"
                        >
                          <p className="mb-2 text-xs text-slate-300/80">Arrastra un archivo PDF</p>
                          <input
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={(event) => handleDocumentFile(index, event.target.files?.[0])}
                            className="w-full text-xs text-slate-300"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex items-center gap-2 rounded-lg border border-slate-500/30 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/40"
                  >
                    <FiX size={16} />
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingCase}
                    className="rounded-lg border border-orange-400/40 bg-orange-500/20 px-4 py-2 font-mono text-sm font-semibold text-orange-100 transition disabled:opacity-60 hover:bg-orange-500/30"
                  >
                    {savingCase ? 'Guardando...' : isEditMode ? 'Guardar Cambios' : 'Crear Caso'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isViewerOpen && caseViewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
            <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-cyan-500/40 bg-slate-800/95 p-8 shadow-[0_0_40px_rgba(0,200,255,0.25)] backdrop-blur-lg">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="font-mono text-2xl font-semibold tracking-[0.2em] text-cyan-200">{caseViewData.nombre}</h2>
                  <p className="mt-2 text-slate-300">{caseViewData.descripcion}</p>
                </div>
                <button
                  onClick={closeViewerModal}
                  className="flex items-center gap-1 rounded border border-slate-500/30 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700/40"
                >
                  <FiX size={16} />
                </button>
              </div>

              <div className="mb-4" />

              {caseViewData.imagen_url && (
                <div className="mb-6 rounded-lg border border-cyan-500/20 bg-slate-950/50 p-4">
                  <img src={caseViewData.imagen_url} alt={caseViewData.nombre} className="h-64 w-full rounded-lg object-cover" />
                </div>
              )}

              <h3 className="mb-4 font-mono text-lg font-semibold tracking-[0.15em] text-cyan-200">
                DOCUMENTOS ({viewerDocumentos.length})
              </h3>

              {viewerLoading ? (
                <div className="font-mono text-cyan-300">Cargando documentos...</div>
              ) : viewerDocumentos.length === 0 ? (
                <div className="rounded-lg border border-slate-500/20 bg-slate-900/50 p-6 text-center">
                  <p className="font-mono text-sm text-slate-400">No hay documentos en este caso.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="space-y-3 lg:col-span-1">
                    <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Archivos</h4>
                    {viewerDocumentos.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedDocument(doc)}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          selectedDocument?.id === doc.id
                            ? 'border-cyan-400/60 bg-cyan-500/10'
                            : 'border-slate-500/20 bg-slate-900/50 hover:border-cyan-400/30'
                        }`}
                      >
                        <div className="truncate font-mono text-xs font-semibold text-slate-100">{doc.nombre}</div>
                        <div className="mt-1 truncate text-xs text-slate-400">{doc.descripcion}</div>
                        <div className="mt-2 flex items-center gap-1 text-xs text-cyan-300/60">
                          <FiFile size={12} />
                          PDF
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col items-center justify-center rounded-lg border border-cyan-500/20 bg-slate-900/70 p-4 lg:col-span-2">
                    {selectedDocument ? (
                      <div className="w-full space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h5 className="font-mono text-sm font-semibold text-slate-100">{selectedDocument.nombre}</h5>
                            <p className="mt-1 text-xs text-slate-400">{selectedDocument.descripcion}</p>
                          </div>
                          <button
                            onClick={() => downloadDocument(selectedDocument)}
                            className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 font-mono text-sm font-semibold text-green-200 transition hover:bg-green-500/20 whitespace-nowrap"
                          >
                            <FiDownload size={16} />
                            Descargar
                          </button>
                        </div>

                        {isPdfFile(selectedDocument.archivo_url) ? (
                          <div className="rounded-lg border border-slate-500/20 bg-slate-950/50 overflow-hidden">
                            <iframe
                              src={getPdfViewerSrc(selectedDocument.archivo_url)}
                              className="h-[520px] w-full border-0"
                              title={selectedDocument.nombre}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 py-8">
                            <FiAlertTriangle size={40} className="text-red-400" />
                            <p className="font-mono text-sm text-red-300">Archivo no válido</p>
                            <p className="text-xs text-slate-400">El visor solo abre PDFs reales (base64 PDF o URL terminada en .pdf).</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 py-16">
                        <FiFolder size={48} className="text-slate-400" />
                        <p className="font-mono text-sm text-slate-400 text-center">Selecciona un documento para verlo</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isConnectionModalOpen && connectionSourceCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-blue-500/40 bg-slate-800/95 p-6 shadow-[0_0_40px_rgba(59,130,246,0.25)] backdrop-blur-lg">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="font-mono text-lg font-semibold tracking-[0.2em] text-blue-200">CONEXIONES DEL CASO</h3>
                <button
                  onClick={closeConnectionModal}
                  className="flex items-center gap-1 rounded border border-slate-500/30 px-3 py-1 text-sm text-slate-300 hover:bg-slate-700/40"
                >
                  <FiX size={16} />
                </button>
              </div>

              <div className="mb-4 rounded-lg border border-blue-500/20 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-blue-300">Caso base</p>
                <p className="mt-1 font-mono text-sm text-slate-100">{connectionSourceCase.nombre}</p>
                <p className="mt-1 text-xs text-slate-400">{connectionSourceCase.descripcion}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-blue-500/20 bg-slate-900/60 p-4">
                  <h4 className="mb-3 font-mono text-sm font-semibold text-blue-200">Nueva conexión</h4>

                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-300">Caso destino</label>
                  <select
                    value={connectionData.carpeta_destino_id}
                    onChange={(event) =>
                      setConnectionData((current) => ({
                        ...current,
                        carpeta_destino_id: event.target.value,
                      }))
                    }
                    className="mb-3 w-full rounded-lg border border-blue-500/20 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none"
                  >
                    <option value="">Selecciona un caso</option>
                    {destinationOptions.map((caseItem) => (
                      <option key={caseItem.id} value={caseItem.id}>
                        {caseItem.nombre}
                      </option>
                    ))}
                  </select>

                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-300">Tipo de conexión</label>
                  <select
                    value={connectionData.tipo}
                    onChange={(event) =>
                      setConnectionData((current) => ({
                        ...current,
                        tipo: event.target.value,
                      }))
                    }
                    className="mb-3 w-full rounded-lg border border-blue-500/20 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none"
                  >
                    <option value="modalidad">Modalidad</option>
                    <option value="patrones">Patrones</option>
                  </select>

                  <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-300">Justificación</label>
                  <textarea
                    value={connectionData.razonamiento}
                    onChange={(event) =>
                      setConnectionData((current) => ({
                        ...current,
                        razonamiento: event.target.value,
                      }))
                    }
                    rows="3"
                    placeholder="Explica por qué esta conexión es válida"
                    className="mb-3 w-full rounded-lg border border-blue-500/20 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none"
                  />

                  <button
                    onClick={crearConexion}
                    disabled={connectionSaving}
                    className="w-full rounded-lg border border-blue-400/40 bg-blue-500/20 px-4 py-2 font-mono text-sm font-semibold text-blue-100 transition disabled:opacity-60 hover:bg-blue-500/30"
                  >
                    {connectionSaving ? 'Validando y conectando...' : 'Crear conexión'}
                  </button>

                  {connectionFeedback && (
                    <div
                      className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                        connectionFeedback.valido
                          ? 'border-green-500/30 bg-green-500/10 text-green-200'
                          : 'border-red-500/30 bg-red-500/10 text-red-200'
                      }`}
                    >
                      {connectionFeedback.valido ? 'Conectado' : 'No válido'}: {connectionFeedback.razon}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-blue-500/20 bg-slate-900/60 p-4">
                  <h4 className="mb-3 font-mono text-sm font-semibold text-blue-200">Conexiones existentes</h4>

                  {existingConnections.length === 0 ? (
                    <p className="text-sm text-slate-400">Este caso no tiene conexiones todavía.</p>
                  ) : (
                    <div className="space-y-2">
                      {existingConnections.map((connection) => {
                        const otroCaso =
                          connection.carpeta_origen_id === selectedCaseId
                            ? connection.caso_destino
                            : connection.caso_origen;

                        return (
                          <div
                            key={connection.id}
                            className="rounded-lg border border-slate-500/20 bg-slate-950/60 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-mono text-xs text-slate-100">{otroCaso}</p>
                                <p className="mt-1 text-xs text-blue-300/80">Tipo: {connection.tipo}</p>
                                <p className="mt-1 text-xs text-slate-400">{connection.razonamiento}</p>
                              </div>
                              <button
                                onClick={() => eliminarConexion(connection.id)}
                                className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                              >
                                <FiTrash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isConfigModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
            <div className="w-full max-w-sm rounded-2xl border border-slate-500/40 bg-slate-800/95 p-6 shadow-[0_0_40px_rgba(255,255,255,0.1)] backdrop-blur-lg">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="font-mono text-lg font-semibold tracking-[0.1em] text-slate-200">
                  CONFIGURACIÓN GLOBAL
                </h3>
                <button
                  onClick={() => setIsConfigModalOpen(false)}
                  className="rounded border border-slate-500/30 p-1 text-slate-300 hover:bg-slate-700/40"
                >
                  <FiX size={16} />
                </button>
              </div>
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">
                    Tiempo Límite (minutos)
                  </label>
                  <p className="mt-1 text-[11px] text-slate-400">Este tiempo aplicará para el Modo Caso Complejo en todos los investigadores.</p>
                  <input
                    type="number"
                    min="60"
                    required
                    value={configData.tiempo_limite_minutos}
                    onChange={(e) => setConfigData({ ...configData, tiempo_limite_minutos: parseInt(e.target.value, 10) })}
                    className="mt-2 w-full rounded-lg border border-slate-500/30 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
                  >
                    {savingConfig ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default DashboardAdmin;
