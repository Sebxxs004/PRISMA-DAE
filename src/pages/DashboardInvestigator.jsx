import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiFileText,
  FiFolder,
  FiLink,
  FiMapPin,
  FiPlay,
  FiSave,
  FiShield,
  FiTarget,
  FiUsers,
  FiXCircle,
} from 'react-icons/fi';
import useAuthStore from '../store/useAuthStore';

const API_URL = import.meta.env.DEV ? 'http://localhost:5000/api' : (import.meta.env.VITE_API_URL || '/api');
const TICK_MS = 50;
const NODE_RADIUS = 34;
const GROUP_COLOR_PALETTE = ['#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#f97316'];
const ACTOR_BADGE_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#f97316'];

const CASE_METADATA_FALLBACKS = [
  {
    offenseType: 'Concierto para delinquir',
    zone: 'Area Metropolitana',
    actors: ['FGN', 'CTI'],
  },
  {
    offenseType: 'Extorsion',
    zone: 'Zona Urbana',
    actors: ['SIJIN', 'Policia Judicial'],
  },
  {
    offenseType: 'Lavado de activos',
    zone: 'Corredor financiero',
    actors: ['UIAF', 'Fiscalia Seccional'],
  },
];

function isPdfUrl(value) {
  if (!value) return false;

  const normalized = String(value).trim();
  if (normalized.startsWith('data:application/pdf')) {
    return true;
  }

  return /^https?:\/\//i.test(normalized) && /\.pdf($|\?|#)/i.test(normalized);
}

function getPdfViewerSrc(value) {
  if (!isPdfUrl(value)) {
    return null;
  }

  return String(value).trim();
}

function connectPairSet(pairIds) {
  const pairs = [];
  for (let i = 0; i < pairIds.length; i += 1) {
    for (let j = i + 1; j < pairIds.length; j += 1) {
      pairs.push({ a: pairIds[i], b: pairIds[j] });
    }
  }
  return pairs;
}

function getPairKey(a, b) {
  const first = String(a);
  const second = String(b);
  return first.localeCompare(second) <= 0 ? `${first}__${second}` : `${second}__${first}`;
}

function buildComponents(nodeIds, edges) {
  const adjacency = new Map();
  nodeIds.forEach((id) => adjacency.set(id, new Set()));

  edges.forEach(({ a, b }) => {
    if (!adjacency.has(a) || !adjacency.has(b)) {
      return;
    }

    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  });

  const visited = new Set();
  const components = [];

  nodeIds.forEach((startId) => {
    if (visited.has(startId)) {
      return;
    }

    const queue = [startId];
    const current = [];
    visited.add(startId);

    while (queue.length > 0) {
      const currentId = queue.shift();
      current.push(currentId);
      adjacency.get(currentId).forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }

    if (current.length > 1) {
      current.sort((a, b) => String(a).localeCompare(String(b)));
      components.push(current);
    }
  });

  return components.sort((a, b) => a.length - b.length);
}

function formatSeconds(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((safe % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(safe % 60)
    .toString()
    .padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
}

function getDefaultGroupColor(index) {
  return GROUP_COLOR_PALETTE[index % GROUP_COLOR_PALETTE.length];
}

function hexToRgba(hex, alpha) {
  const normalized = String(hex || '').replace('#', '').trim();
  if (normalized.length !== 6) {
    return `rgba(56, 189, 248, ${alpha})`;
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function formatPairLabel(pairKey, nameById) {
  const [a, b] = String(pairKey || '').split('__');
  const nameA = nameById.get(a) || a;
  const nameB = nameById.get(b) || b;
  return `${nameA} - ${nameB}`;
}

function firstDefinedValue(...values) {
  const found = values.find((value) => value !== null && value !== undefined && String(value).trim() !== '');
  return found === undefined ? null : found;
}

function normalizeActors(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof rawValue === 'string') {
    return rawValue
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function formatCaseDate(dateValue) {
  if (!dateValue) {
    return 'Sin fecha';
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return String(dateValue);
  }

  return parsed.toLocaleDateString('es-CO');
}

function buildCaseMetadata(caseItem, index) {
  const fallback = CASE_METADATA_FALLBACKS[index % CASE_METADATA_FALLBACKS.length];

  const offenseType =
    firstDefinedValue(caseItem.tipo_delito, caseItem.delito, caseItem.tipo, caseItem.categoria_delito) ||
    fallback.offenseType;
  const caseDate =
    firstDefinedValue(caseItem.fecha_hecho, caseItem.fecha, caseItem.fecha_caso, caseItem.created_at) || null;
  const victim = firstDefinedValue(caseItem.victima, caseItem.victimas, caseItem.perfil_victima) || 'Sin registrar';
  const offender =
    firstDefinedValue(caseItem.victimario, caseItem.victimarios, caseItem.indiciado, caseItem.imputado) ||
    'Sin registrar';
  const zone =
    firstDefinedValue(caseItem.zona_territorial, caseItem.territorio, caseItem.zona, caseItem.municipio) ||
    fallback.zone;

  const actors = normalizeActors(firstDefinedValue(caseItem.actores_involucrados, caseItem.actores, caseItem.equipo));
  const finalActors = actors.length > 0 ? actors : fallback.actors;

  return {
    offenseType: String(offenseType),
    caseDate,
    caseDateLabel: formatCaseDate(caseDate),
    victim: String(victim),
    offender: String(offender),
    zone: String(zone),
    actors: finalActors,
    offenseTag: String(offenseType).slice(0, 1).toUpperCase() || 'C',
  };
}

function buildGroupSnapshot(group, currentConnections, caseNameById, caseMetadataById) {
  const memberIds = [...group.ids];
  const memberSet = new Set(memberIds);
  const nodePositions = new Map(group.nodes.map((node) => [node.id, node]));

  const nodes = memberIds.map((nodeId) => {
    const metadata = caseMetadataById.get(nodeId);
    const fallbackName = caseNameById.get(String(nodeId)) || String(nodeId);
    const position = nodePositions.get(nodeId) || { x: 0, y: 0 };

    return {
      id: nodeId,
      name: fallbackName,
      offenseType: metadata?.offenseType || 'Sin delito',
      caseDateLabel: metadata?.caseDateLabel || 'Sin fecha',
      zone: metadata?.zone || 'Sin zona',
      x: position.x,
      y: position.y,
    };
  });

  const connections = currentConnections
    .filter((edge) => memberSet.has(edge.a) && memberSet.has(edge.b))
    .map((edge) => ({
      key: getPairKey(edge.a, edge.b),
      sourceId: edge.a,
      targetId: edge.b,
      sourceName: caseNameById.get(String(edge.a)) || String(edge.a),
      targetName: caseNameById.get(String(edge.b)) || String(edge.b),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    finalizedAt: Date.now(),
    groupName: group.name,
    relationType: group.relationType,
    color: group.color,
    nodes,
    cases: nodes,
    connections,
  };
}

function buildCompactGraphLayout(nodes, width = 320, height = 150) {
  if (!nodes.length) {
    return { nodes: [], width, height };
  }

  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const padding = 18;

  return {
    width,
    height,
    nodes: nodes.map((node) => ({
      ...node,
      x: padding + ((node.x - minX) / spanX) * Math.max(1, width - padding * 2),
      y: padding + ((node.y - minY) / spanY) * Math.max(1, height - padding * 2),
    })),
  };
}

function DashboardInvestigator({ token }) {
  const boardRef = useRef(null);
  const groupedRegionsRef = useRef([]);
  const { usuario, logout } = useAuthStore();

  const [carpetas, setCarpetas] = useState([]);
  const [documentsByCase, setDocumentsByCase] = useState({});
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isCaseSummaryOpen, setIsCaseSummaryOpen] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  const [nodes, setNodes] = useState([]);
  const [velocities, setVelocities] = useState({});
  const [connections, setConnections] = useState([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [finalizedGroups, setFinalizedGroups] = useState({});

  const [startTimestamp, setStartTimestamp] = useState(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [connectionJustifications, setConnectionJustifications] = useState({});
  const [pendingConnections, setPendingConnections] = useState([]);
  const [justificationText, setJustificationText] = useState('');
  const [activeTab, setActiveTab] = useState('tablero');
  const [caseGuesses, setCaseGuesses] = useState({});
  const [groupGuesses, setGroupGuesses] = useState({});
  const [tiempoLimiteMinutos, setTiempoLimiteMinutos] = useState(10);
  const [autorIntelectualGuess, setAutorIntelectualGuess] = useState('');
  const [zonaOperacionGuess, setZonaOperacionGuess] = useState('');
  const [objetivosFeedback, setObjetivosFeedback] = useState(null);

  const [groupMeta, setGroupMeta] = useState({});
  const [finishing, setFinishing] = useState(false);
  const [investigationFinished, setInvestigationFinished] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [disagreementReasons, setDisagreementReasons] = useState({});
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackChecking, setFeedbackChecking] = useState(true);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [savingJustifications, setSavingJustifications] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    let cancelled = false;

    const loadCases = async () => {
      setLoadingCases(true);
      try {
        const response = await axios.get(`${API_URL}/carpetas`, { headers: authHeaders });
        if (cancelled) {
          return;
        }

        const cases = response.data || [];
        setCarpetas(cases);

        const board = boardRef.current;
        const boardWidth = Math.max(700, board?.clientWidth || 980);
        const boardHeight = Math.max(420, board?.clientHeight || 600);

        const generatedNodes = cases.map((caseItem, index) => ({
          id: caseItem.id,
          label: caseItem.nombre,
          x: 90 + ((index * 109) % Math.max(220, boardWidth - 200)),
          y: 90 + ((index * 83) % Math.max(180, boardHeight - 200)),
        }));

        const generatedVelocities = {};
        cases.forEach((caseItem, index) => {
          const speedX = (index % 2 === 0 ? 1 : -1) * (0.75 + (index % 5) * 0.12);
          const speedY = (index % 2 === 1 ? 1 : -1) * (0.82 + (index % 7) * 0.1);
          generatedVelocities[caseItem.id] = { vx: speedX, vy: speedY };
        });

        setNodes(generatedNodes);
        setVelocities(generatedVelocities);
      } catch (requestError) {
        console.error('Error loading cases for investigator:', requestError);
        if (!cancelled) {
          setError('No fue posible cargar las carpetas para el investigador.');
        }
      } finally {
        if (!cancelled) {
          setLoadingCases(false);
        }
      }
    };

    const loadConfig = async () => {
      try {
        const response = await axios.get(`${API_URL}/configuracion`, { headers: authHeaders });
        if (!cancelled && response.data) {
          setTiempoLimiteMinutos(response.data.tiempo_limite_minutos || 60);
        }
      } catch (err) {
        console.error('Error cargando configuracion:', err);
      }
    };

    const loadDraft = async () => {
      try {
        const response = await axios.get(`${API_URL}/investigacion-feedback/me/draft`, { headers: authHeaders });
        if (!cancelled && response.data && response.data.draft) {
          const draft = response.data.draft;
          if (draft.connections) setConnections(draft.connections);
          if (draft.finalizedGroups) setFinalizedGroups(draft.finalizedGroups);
          if (draft.startTimestamp) setStartTimestamp(draft.startTimestamp);
          if (draft.elapsedSeconds) setElapsedSeconds(draft.elapsedSeconds);
          if (draft.autorIntelectualGuess) setAutorIntelectualGuess(draft.autorIntelectualGuess);
          if (draft.zonaOperacionGuess) setZonaOperacionGuess(draft.zonaOperacionGuess);
          if (draft.connectionJustifications) setConnectionJustifications(draft.connectionJustifications);
          if (draft.caseGuesses) setCaseGuesses(draft.caseGuesses);
          if (draft.groupGuesses) setGroupGuesses(draft.groupGuesses);
        }
      } catch (err) {
        console.error('Error cargando borrador:', err);
      }
    };

    loadCases();
    loadConfig();
    loadDraft();

    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  useEffect(() => {
    if (!selectedCaseId || documentsByCase[selectedCaseId]) {
      return;
    }

    let cancelled = false;

    const loadDocuments = async () => {
      setLoadingDocuments(true);
      try {
        const response = await axios.get(`${API_URL}/documentos/carpeta/${selectedCaseId}`, {
          headers: authHeaders,
        });

        if (!cancelled) {
          setDocumentsByCase((current) => ({ ...current, [selectedCaseId]: response.data || [] }));
        }
      } catch (requestError) {
        console.error('Error loading documents for case:', requestError);
        if (!cancelled) {
          setError('No fue posible cargar documentos del caso seleccionado.');
        }
      } finally {
        if (!cancelled) {
          setLoadingDocuments(false);
        }
      }
    };

    loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [selectedCaseId, authHeaders, documentsByCase]);

  const finalizedNodeIds = useMemo(() => {
    const ids = new Set();
    Object.values(finalizedGroups).forEach((group) => {
      (group.nodes || group.cases || []).forEach((node) => {
        ids.add(String(node.id));
      });
    });
    return ids;
  }, [finalizedGroups]);

  useEffect(() => {
    if (investigationFinished || validationResult || feedbackSubmitted) return;

    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimestamp) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [startTimestamp, investigationFinished, validationResult, feedbackSubmitted]);

  // Auto-save borrador cada 5 segundos si hubo cambios
  useEffect(() => {
    if (investigationFinished || validationResult || feedbackSubmitted || loadingCases) return;

    const saveDraft = async () => {
      try {
        const draftData = {
          connections,
          finalizedGroups,
          startTimestamp,
          elapsedSeconds,
          autorIntelectualGuess,
          zonaOperacionGuess,
          connectionJustifications,
          caseGuesses,
          groupGuesses
        };
        await axios.put(`${API_URL}/investigacion-feedback/me/draft`, { estado_json: draftData }, { headers: authHeaders });
      } catch (err) {
        console.error('Error guardando borrador:', err);
      }
    };

    const handler = setTimeout(saveDraft, 5000);
    return () => clearTimeout(handler);
  }, [connections, finalizedGroups, startTimestamp, elapsedSeconds, autorIntelectualGuess, zonaOperacionGuess, connectionJustifications, caseGuesses, groupGuesses, investigationFinished, validationResult, feedbackSubmitted, loadingCases, authHeaders]);

  useEffect(() => {
    if (!investigationFinished && !validationResult && !finishing) {
      const remaining = tiempoLimiteMinutos * 60 - elapsedSeconds;
      if (remaining <= 0) {
        finishInvestigation();
      }
    }
  }, [elapsedSeconds, tiempoLimiteMinutos, investigationFinished, validationResult, finishing]);

  const activeNodes = useMemo(() => nodes, [nodes]);

  const activeConnections = useMemo(() => connections, [connections]);

  const activeNodeById = useMemo(() => {
    const map = new Map();
    activeNodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [activeNodes]);

  const activeNodeIds = useMemo(() => activeNodes.map((node) => node.id), [activeNodes]);

  useEffect(() => {
    if (investigationFinished || activeNodes.length < 2) {
      return undefined;
    }

    const activeNodeIdSet = new Set(activeNodeIds.map((nodeId) => String(nodeId)));

    const interval = setInterval(() => {
      const board = boardRef.current;
      const boardWidth = Math.max(700, board?.clientWidth || 980);
      const boardHeight = Math.max(420, board?.clientHeight || 600);
      const minX = NODE_RADIUS;
      const maxX = boardWidth - NODE_RADIUS;
      const minY = NODE_RADIUS;
      const maxY = boardHeight - NODE_RADIUS;
      const minDistance = NODE_RADIUS * 2;
      const nextVelocities = { ...velocities };
      const protectedRegions = groupedRegionsRef.current;
      const regionByNodeId = new Map();

      protectedRegions.forEach((region) => {
        region.ids.forEach((nodeId) => {
          regionByNodeId.set(nodeId, region);
        });
      });

      const getRegionVelocity = (region, fallbackNodeId) => {
        if (!region || region.ids.length <= 1) {
          return nextVelocities[fallbackNodeId] || { vx: 1, vy: 1 };
        }

        const sharedVelocity = region.ids.reduce(
          (accumulator, nodeId) => {
            const speed = nextVelocities[nodeId] || { vx: 1, vy: 1 };
            return {
              vx: accumulator.vx + speed.vx,
              vy: accumulator.vy + speed.vy,
            };
          },
          { vx: 0, vy: 0 }
        );

        return {
          vx: sharedVelocity.vx / region.ids.length,
          vy: sharedVelocity.vy / region.ids.length,
        };
      };

      setNodes((currentNodes) => {
        const movedNodes = currentNodes.map((node) => {
          if (!activeNodeIdSet.has(String(node.id))) {
            return node;
          }

          const region = regionByNodeId.get(node.id);
          const speed = getRegionVelocity(region, node.id);
          let nextX = node.x + speed.vx;
          let nextY = node.y + speed.vy;
          let vx = speed.vx;
          let vy = speed.vy;

          if (nextX < minX || nextX > maxX) {
            vx = -vx;
            nextX = Math.min(Math.max(minX, nextX), maxX);
          }
          if (nextY < minY || nextY > maxY) {
            vy = -vy;
            nextY = Math.min(Math.max(minY, nextY), maxY);
          }

          for (let regionIndex = 0; regionIndex < protectedRegions.length; regionIndex += 1) {
            const region = protectedRegions[regionIndex];
            if (region.ids.includes(node.id)) {
              continue;
            }

            const regionLeft = region.x;
            const regionRight = region.x + region.width;
            const regionTop = region.y;
            const regionBottom = region.y + region.height;
            const insideRegion = nextX > regionLeft && nextX < regionRight && nextY > regionTop && nextY < regionBottom;

            if (!insideRegion) {
              continue;
            }

            const distLeft = Math.abs(nextX - regionLeft);
            const distRight = Math.abs(regionRight - nextX);
            const distTop = Math.abs(nextY - regionTop);
            const distBottom = Math.abs(regionBottom - nextY);
            const nearest = Math.min(distLeft, distRight, distTop, distBottom);

            if (nearest === distLeft) {
              nextX = Math.max(minX, regionLeft - 1);
              vx = -Math.abs(vx);
            } else if (nearest === distRight) {
              nextX = Math.min(maxX, regionRight + 1);
              vx = Math.abs(vx);
            } else if (nearest === distTop) {
              nextY = Math.max(minY, regionTop - 1);
              vy = -Math.abs(vy);
            } else {
              nextY = Math.min(maxY, regionBottom + 1);
              vy = Math.abs(vy);
            }
          }

          nextVelocities[node.id] = { vx, vy };

          return {
            ...node,
            x: nextX,
            y: nextY,
          };
        });

        const pushRegion = (region, deltaX, deltaY, resolvedVelocities) => {
          if (!region) {
            return;
          }

          region.ids.forEach((nodeId) => {
            if (!activeNodeIdSet.has(String(nodeId))) {
              return;
            }

            const node = movedNodes.find((item) => item.id === nodeId);
            if (!node) {
              return;
            }

            node.x = Math.min(Math.max(minX, node.x + deltaX), maxX);
            node.y = Math.min(Math.max(minY, node.y + deltaY), maxY);
          });

          region.ids.forEach((nodeId) => {
            if (!activeNodeIdSet.has(String(nodeId))) {
              return;
            }

            const currentVelocity = resolvedVelocities[nodeId] || { vx: 1, vy: 1 };
            resolvedVelocities[nodeId] = {
              vx: deltaX !== 0 ? -currentVelocity.vx : currentVelocity.vx,
              vy: deltaY !== 0 ? -currentVelocity.vy : currentVelocity.vy,
            };
          });
        };

        for (let i = 0; i < movedNodes.length; i += 1) {
          for (let j = i + 1; j < movedNodes.length; j += 1) {
            const firstNode = movedNodes[i];
            const secondNode = movedNodes[j];
            const firstRegion = regionByNodeId.get(firstNode.id);
            const secondRegion = regionByNodeId.get(secondNode.id);

            if (firstRegion && secondRegion && firstRegion.key === secondRegion.key) {
              continue;
            }

            let dx = secondNode.x - firstNode.x;
            let dy = secondNode.y - firstNode.y;
            let distance = Math.hypot(dx, dy);

            if (distance >= minDistance) {
              continue;
            }

            if (distance < 0.0001) {
              dx = 0.0001;
              dy = 0;
              distance = 0.0001;
            }

            const normalX = dx / distance;
            const normalY = dy / distance;
            const overlap = minDistance - distance;

            firstNode.x = Math.min(Math.max(minX, firstNode.x - normalX * (overlap / 2)), maxX);
            firstNode.y = Math.min(Math.max(minY, firstNode.y - normalY * (overlap / 2)), maxY);
            secondNode.x = Math.min(Math.max(minX, secondNode.x + normalX * (overlap / 2)), maxX);
            secondNode.y = Math.min(Math.max(minY, secondNode.y + normalY * (overlap / 2)), maxY);

            const velocityA = nextVelocities[firstNode.id] || { vx: 1, vy: 1 };
            const velocityB = nextVelocities[secondNode.id] || { vx: 1, vy: 1 };
            const relativeVX = velocityB.vx - velocityA.vx;
            const relativeVY = velocityB.vy - velocityA.vy;
            const velocityAlongNormal = relativeVX * normalX + relativeVY * normalY;

            if (velocityAlongNormal < 0) {
              const impulse = -velocityAlongNormal;
              nextVelocities[firstNode.id] = {
                vx: velocityA.vx - impulse * normalX,
                vy: velocityA.vy - impulse * normalY,
              };
              nextVelocities[secondNode.id] = {
                vx: velocityB.vx + impulse * normalX,
                vy: velocityB.vy + impulse * normalY,
              };
            }
          }
        }

        for (let i = 0; i < protectedRegions.length; i += 1) {
          for (let j = i + 1; j < protectedRegions.length; j += 1) {
            const firstRegion = protectedRegions[i];
            const secondRegion = protectedRegions[j];

            const firstLeft = firstRegion.x;
            const firstRight = firstRegion.x + firstRegion.width;
            const firstTop = firstRegion.y;
            const firstBottom = firstRegion.y + firstRegion.height;

            const secondLeft = secondRegion.x;
            const secondRight = secondRegion.x + secondRegion.width;
            const secondTop = secondRegion.y;
            const secondBottom = secondRegion.y + secondRegion.height;

            const overlapX = Math.min(firstRight, secondRight) - Math.max(firstLeft, secondLeft);
            const overlapY = Math.min(firstBottom, secondBottom) - Math.max(firstTop, secondTop);

            if (overlapX <= 0 || overlapY <= 0) {
              continue;
            }

            if (overlapX < overlapY) {
              const shiftX = overlapX / 2 + 1;
              const direction = firstLeft <= secondLeft ? -1 : 1;
              pushRegion(firstRegion, direction * shiftX, 0, nextVelocities);
              pushRegion(secondRegion, -direction * shiftX, 0, nextVelocities);
            } else {
              const shiftY = overlapY / 2 + 1;
              const direction = firstTop <= secondTop ? -1 : 1;
              pushRegion(firstRegion, 0, direction * shiftY, nextVelocities);
              pushRegion(secondRegion, 0, -direction * shiftY, nextVelocities);
            }
          }
        }

        setVelocities(nextVelocities);

        return movedNodes;
      });
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [velocities, activeNodes.length, activeNodeIds, investigationFinished]);

  const selectedCase = useMemo(
    () => carpetas.find((caseItem) => caseItem.id === selectedCaseId) || null,
    [carpetas, selectedCaseId]
  );

  useEffect(() => {
    if (selectedCase) {
      setIsCaseSummaryOpen(true);
      setSelectedDocument(null);
      return;
    }

    setIsCaseSummaryOpen(false);
    setSelectedDocument(null);
  }, [selectedCase]);

  const selectedCaseDocuments = useMemo(
    () => documentsByCase[selectedCaseId] || [],
    [documentsByCase, selectedCaseId]
  );

  const caseMetadataById = useMemo(() => {
    const map = new Map();
    carpetas.forEach((caseItem, index) => {
      map.set(caseItem.id, buildCaseMetadata(caseItem, index));
    });
    return map;
  }, [carpetas]);

  const selectedCaseMetadata = useMemo(() => {
    if (!selectedCase) {
      return null;
    }
    return caseMetadataById.get(selectedCase.id) || null;
  }, [selectedCase, caseMetadataById]);



  const caseNameById = useMemo(() => {
    const map = new Map();
    carpetas.forEach((caseItem) => {
      map.set(String(caseItem.id), caseItem.nombre || String(caseItem.id));
    });
    return map;
  }, [carpetas]);

  const buildJustificacionesPayload = (result, reasonsMap) => {
    const combined = [];
    
    // Añadir justificaciones de las conexiones hechas durante la investigacion
    Object.entries(connectionJustifications).forEach(([pairKey, reason]) => {
      combined.push({
        pairKey,
        pairLabel: formatPairLabel(pairKey, caseNameById),
        reason: String(reason).trim(),
      });
    });

    // Añadir/Actualizar justificaciones de desacuerdo post-feedback
    const incorrectPairs = result?.incorrect || [];
    incorrectPairs.forEach((pairKey) => {
      const reason = String(reasonsMap[pairKey] || '').trim();
      if (reason.length > 0) {
        // Verificar si ya existe para reemplazar o agregar
        const existing = combined.find(j => j.pairKey === pairKey);
        if (existing) {
          existing.reason = reason;
        } else {
          combined.push({
            pairKey,
            pairLabel: formatPairLabel(pairKey, caseNameById),
            reason,
          });
        }
      }
    });

    return combined.filter((item) => item.reason.length > 0);
  };

  const hydrateFeedback = (feedback) => {
    if (!feedback) {
      return;
    }

    setValidationResult({
      expectedTotal: feedback.expectedTotal,
      userTotal: feedback.userTotal,
      score: feedback.score,
      correct: feedback.correct || [],
      incorrect: feedback.incorrect || [],
      missing: feedback.missing || [],
    });

    const reasonsMap = {};
    (feedback.justificaciones || []).forEach((item) => {
      reasonsMap[item.pair_key] = item.reason;
    });

    setDisagreementReasons(reasonsMap);
    setFeedbackSubmitted(true);
    setInvestigationFinished(true);
    setSelectedNodeIds([]);
  };

  useEffect(() => {
    let cancelled = false;

    const loadSavedFeedback = async () => {
      setFeedbackChecking(true);
      try {
        const response = await axios.get(`${API_URL}/investigacion-feedback/me`, { headers: authHeaders });
        if (cancelled) {
          return;
        }

        if (response.data?.hasSubmitted && response.data.feedback) {
          hydrateFeedback(response.data.feedback);
        }
      } catch (requestError) {
        console.error('Error consultando feedback guardado:', requestError);
      } finally {
        if (!cancelled) {
          setFeedbackChecking(false);
        }
      }
    };

    loadSavedFeedback();

    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  const components = useMemo(() => buildComponents(activeNodeIds, activeConnections), [activeNodeIds, activeConnections]);

  const groupedRegions = useMemo(() => {
    return components.map((component) => {
      const key = component.join('__');
      const meta = groupMeta[key];
      const componentNodes = component
        .map((nodeId) => activeNodeById.get(nodeId))
        .filter(Boolean);

      const xs = componentNodes.map((node) => node.x);
      const ys = componentNodes.map((node) => node.y);
      const minX = Math.min(...xs) - NODE_RADIUS - 18;
      const maxX = Math.max(...xs) + NODE_RADIUS + 18;
      const minY = Math.min(...ys) - NODE_RADIUS - 18;
      const maxY = Math.max(...ys) + NODE_RADIUS + 18;

      return {
        key,
        ids: component,
        x: minX,
        y: minY,
        width: Math.max(120, maxX - minX),
        height: Math.max(120, maxY - minY),
        color: meta?.color || getDefaultGroupColor(component[0]?.length ? component.length - 1 : 0),
        name: meta?.name || `Grupo ${component.length}`,
      };
    });
  }, [components, groupMeta, activeNodeById]);
  useEffect(() => {
    groupedRegionsRef.current = groupedRegions;
  }, [groupedRegions]);

  const componentsWithMeta = useMemo(() => {
    return components.map((component, index) => {
      const key = component.join('__');
      const componentNodes = component
        .map((nodeId) => activeNodeById.get(nodeId))
        .filter(Boolean);

      return {
        key,
        ids: component,
        nodes: componentNodes,
        index,
        color: groupMeta[key]?.color || getDefaultGroupColor(index),
        name: groupMeta[key]?.name || `Grupo ${index + 1}`,
        relationType: groupMeta[key]?.relationType || 'modalidad',
      };
    });
  }, [components, groupMeta, activeNodeById]);
  useEffect(() => {
    if (componentsWithMeta.length === 0) {
      return;
    }

    setGroupMeta((current) => {
      let changed = false;
      const next = { ...current };
      componentsWithMeta.forEach((component) => {
        if (!next[component.key]) {
          next[component.key] = {
            name: `Grupo ${component.index + 1}`,
            relationType: 'modalidad',
            color: component.color,
          };
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [componentsWithMeta]);

  const onNodeClick = (nodeId) => {
    if (investigationFinished || validationResult) {
      return;
    }

    setError('');
    if (selectedNodeIds.includes(nodeId)) {
      setSelectedNodeIds((current) => current.filter((id) => id !== nodeId));
      return;
    }

    if (selectedNodeIds.length >= 3) {
      setSelectedNodeIds([nodeId]);
      return;
    }

    const nextSelection = [...selectedNodeIds, nodeId];
    setSelectedNodeIds(nextSelection);

    if (nextSelection.length >= 2) {
      const candidateEdges =
        nextSelection.length === 2
          ? [{ a: nextSelection[0], b: nextSelection[1] }]
          : connectPairSet(nextSelection);

      const newEdges = candidateEdges.filter((edge) => {
        const key = getPairKey(edge.a, edge.b);
        return !connections.some((currentEdge) => getPairKey(currentEdge.a, currentEdge.b) === key);
      });

      if (newEdges.length > 0) {
        setPendingConnections(newEdges);
      } else if (nextSelection.length === 3) {
        setSelectedNodeIds([]);
      }
    }
  };

  const removeConnection = (edgeKey) => {
    if (investigationFinished || validationResult) {
      return;
    }

    const [nodeAId, nodeBId] = String(edgeKey).split('__');

    setConnections((current) => {
      const nextConnections = current.filter((edge) => getPairKey(edge.a, edge.b) !== edgeKey);
      
      // Eliminar justificacion de la conexion borrada
      setConnectionJustifications(prev => {
        const newJ = { ...prev };
        delete newJ[edgeKey];
        return newJ;
      });
      
      const nextComponents = buildComponents(activeNodeIds, nextConnections);
      const affectedComponents = nextComponents.filter((component) => component.includes(nodeAId) || component.includes(nodeBId));

      if (affectedComponents.length >= 2) {
        const nodePositions = new Map(activeNodes.map((node) => [node.id, node]));
        const endpointA = nodePositions.get(nodeAId);
        const endpointB = nodePositions.get(nodeBId);

        if (endpointA && endpointB) {
          const midpointX = (endpointA.x + endpointB.x) / 2;
          const midpointY = (endpointA.y + endpointB.y) / 2;
          const releaseDistance = NODE_RADIUS * 1.2;

          setNodes((currentNodes) => {
            return currentNodes.map((node) => {
              const component = affectedComponents.find((item) => item.includes(node.id));
              if (!component) {
                return node;
              }

              const componentNodes = component
                .map((nodeId) => nodePositions.get(nodeId))
                .filter(Boolean);

              const centroid = componentNodes.reduce(
                (accumulator, currentNode) => ({
                  x: accumulator.x + currentNode.x,
                  y: accumulator.y + currentNode.y,
                }),
                { x: 0, y: 0 }
              );

              const centerX = centroid.x / Math.max(1, componentNodes.length);
              const centerY = centroid.y / Math.max(1, componentNodes.length);
              let directionX = centerX - midpointX;
              let directionY = centerY - midpointY;
              let distance = Math.hypot(directionX, directionY);

              if (distance < 0.001) {
                directionX = node.id === nodeAId ? -1 : 1;
                directionY = node.id === nodeAId ? -0.25 : 0.25;
                distance = Math.hypot(directionX, directionY);
              }

              const normalizedX = directionX / distance;
              const normalizedY = directionY / distance;

              return {
                ...node,
                x: Math.min(Math.max(NODE_RADIUS, node.x + normalizedX * releaseDistance), Math.max(NODE_RADIUS, (boardRef.current?.clientWidth || 980) - NODE_RADIUS)),
                y: Math.min(Math.max(NODE_RADIUS, node.y + normalizedY * releaseDistance), Math.max(NODE_RADIUS, (boardRef.current?.clientHeight || 600) - NODE_RADIUS)),
              };
            });
          });

          setVelocities((currentVelocities) => {
            const nextVelocities = { ...currentVelocities };

            affectedComponents.forEach((component) => {
              const componentNodes = component
                .map((nodeId) => nodePositions.get(nodeId))
                .filter(Boolean);

              const centroid = componentNodes.reduce(
                (accumulator, currentNode) => ({
                  x: accumulator.x + currentNode.x,
                  y: accumulator.y + currentNode.y,
                }),
                { x: 0, y: 0 }
              );

              const centerX = centroid.x / Math.max(1, componentNodes.length);
              const centerY = centroid.y / Math.max(1, componentNodes.length);
              let directionX = centerX - midpointX;
              let directionY = centerY - midpointY;
              let distance = Math.hypot(directionX, directionY);

              if (distance < 0.001) {
                directionX = component.includes(nodeAId) ? -1 : 1;
                directionY = component.includes(nodeAId) ? -0.25 : 0.25;
                distance = Math.hypot(directionX, directionY);
              }

              const normalizedX = directionX / distance;
              const normalizedY = directionY / distance;

              component.forEach((nodeId) => {
                nextVelocities[nodeId] = {
                  vx: normalizedX * 1.25,
                  vy: normalizedY * 1.25,
                };
              });
            });

            return nextVelocities;
          });
        }
      }

      return nextConnections;
    });

    setSelectedNodeIds((current) => current.filter((nodeId) => nodeId !== nodeAId && nodeId !== nodeBId));
  };

  const updateGroupMeta = (groupKey, patch) => {
    setGroupMeta((current) => ({
      ...current,
      [groupKey]: {
        ...(current[groupKey] || { name: '', relationType: 'modalidad' }),
        ...patch,
      },
    }));
  };

  const finalizeGroup = (group) => {
    setFinalizedGroups((current) => {
      if (current[group.key]) {
        return current;
      }

      const currentGroupNodes = group.nodes && group.nodes.length > 0 ? group.nodes : activeNodes.filter((node) => group.ids.includes(node.id));

      return {
        ...current,
        [group.key]: buildGroupSnapshot(
          { ...group, nodes: currentGroupNodes },
          connections,
          caseNameById,
          caseMetadataById
        ),
      };
    });
    setSelectedNodeIds([]);
  };

  const getGroupColor = (groupKey, index = 0) => {
    return groupMeta[groupKey]?.color || getDefaultGroupColor(index);
  };

  const saveInitialFeedback = async (result) => {
    setSavingFeedback(true);
    try {
      const response = await axios.post(
        `${API_URL}/investigacion-feedback`,
        {
          score: result.score,
          expectedTotal: result.expectedTotal,
          userTotal: result.userTotal,
          correct: result.correct,
          incorrect: result.incorrect,
          missing: result.missing,
          justificaciones: buildJustificacionesPayload(result, disagreementReasons),
          caseGuesses: result.caseGuesses,
          groupGuesses: result.groupGuesses,
          groupJustifications: result.groupJustifications,
        },
        { headers: authHeaders }
      );

      hydrateFeedback(response.data.feedback);
      setFeedbackSubmitted(true);
      return true;
    } catch (requestError) {
      if (requestError.response?.status === 409 && requestError.response?.data?.feedback) {
        hydrateFeedback(requestError.response.data.feedback);
        setFeedbackSubmitted(true);
        return true;
      }

      console.error('Error guardando feedback inicial:', requestError);
      setError('No fue posible guardar tu feedback final.');
      return false;
    } finally {
      setSavingFeedback(false);
    }
  };

  const saveJustifications = async () => {
    if (!validationResult || !feedbackSubmitted) {
      return;
    }

    setSavingJustifications(true);
    try {
      const response = await axios.put(
        `${API_URL}/investigacion-feedback/me/justificaciones`,
        {
          justificaciones: buildJustificacionesPayload(validationResult, disagreementReasons),
        },
        { headers: authHeaders }
      );

      hydrateFeedback(response.data.feedback);
      setError('');
    } catch (requestError) {
      console.error('Error guardando justificaciones:', requestError);
      setError('No fue posible guardar las justificaciones del feedback.');
    } finally {
      setSavingJustifications(false);
    }
  };

  const downloadFeedbackPdf = () => {
    if (!validationResult) {
      return;
    }

    const doc = new jsPDF();
    const lineHeight = 7;
    let y = 16;

    const writeLine = (text, size = 11, color = [20, 20, 20]) => {
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(String(text), 178);
      lines.forEach((line) => {
        if (y > 282) {
          doc.addPage();
          y = 16;
        }
        doc.text(line, 16, y);
        y += lineHeight;
      });
    };

    writeLine('Feedback Investigador - PRISMA DAE', 15, [0, 90, 140]);
    writeLine(`Investigador: ${usuario?.nombre || 'Sin nombre'}`);
    writeLine(`Fecha: ${new Date().toLocaleString()}`);
    writeLine(`Puntaje: ${validationResult.score}%`);
    writeLine(`Esperadas: ${validationResult.expectedTotal} | Trazadas: ${validationResult.userTotal}`);
    writeLine(
      `Formula de puntaje: ${validationResult.correct.length} / ${Math.max(1, validationResult.expectedTotal)}`
    );

    y += 3;
    writeLine('Conexiones incorrectas:', 12, [120, 30, 30]);
    if (validationResult.incorrect.length === 0) {
      writeLine('Ninguna.');
    } else {
      validationResult.incorrect.forEach((pairKey) => {
        writeLine(`- ${formatPairLabel(pairKey, caseNameById)}`);
      });
    }

    y += 3;
    writeLine('Conexiones faltantes:', 12, [140, 90, 0]);
    if (validationResult.missing.length === 0) {
      writeLine('Ninguna.');
    } else {
      validationResult.missing.forEach((pairKey) => {
        writeLine(`- ${formatPairLabel(pairKey, caseNameById)}`);
      });
    }

    y += 3;
    writeLine('Justificaciones de desacuerdo (no vacias):', 12, [60, 60, 60]);
    const justificaciones = buildJustificacionesPayload(validationResult, disagreementReasons);
    if (justificaciones.length === 0) {
      writeLine('Sin justificaciones registradas.');
    } else {
      justificaciones.forEach((item) => {
        writeLine(`- Conexion: ${item.pairLabel}`);
        writeLine(`  Motivo: ${item.reason}`);
      });
    }

    const safeName = (usuario?.nombre || 'investigador').replace(/\s+/g, '-').toLowerCase();
    doc.save(`feedback-${safeName}.pdf`);
  };

  const finishInvestigation = async () => {
    if (validationResult || feedbackSubmitted) {
      setError('Esta prueba ya fue presentada. Solo puedes revisar y descargar tu feedback.');
      return;
    }

    if (connections.length === 0) {
      setError('Debes crear al menos una conexion antes de terminar la investigacion.');
      return;
    }

    setError('');
    setFinishing(true);

    try {
      const groupsResponse = await axios.get(`${API_URL}/grupos-asociacion`, {
        headers: authHeaders,
      });
      const groups = groupsResponse.data || [];

      const groupDetails = await Promise.all(
        groups.map((group) =>
          axios
            .get(`${API_URL}/grupos-asociacion/${group.id}`, { headers: authHeaders })
            .then((response) => response.data)
            .catch(() => null)
        )
      );

      const expectedPairs = new Map();
      groupDetails.forEach((detail) => {
        if (!detail || !Array.isArray(detail.relaciones)) {
          return;
        }
        detail.relaciones.forEach((relation) => {
          const key = getPairKey(relation.carpeta_a_id, relation.carpeta_b_id);
          expectedPairs.set(key, relation.relation_type || 'modalidad');
        });
      });

      const userPairs = new Set(connections.map((edge) => getPairKey(edge.a, edge.b)));

      const correct = [];
      const incorrect = [];
      const missing = [];

      userPairs.forEach((pairKey) => {
        if (expectedPairs.has(pairKey)) {
          correct.push(pairKey);
        } else {
          incorrect.push(pairKey);
        }
      });

      expectedPairs.forEach((_type, pairKey) => {
        if (!userPairs.has(pairKey)) {
          missing.push(pairKey);
        }
      });

      const totalEvaluatedPairs = Math.max(1, expectedPairs.size);
      
      let totalPuntosPosibles = expectedPairs.size;
      let puntosObtenidos = correct.length;

      let autorCorrectoCount = 0;
      let zonaCorrectaCount = 0;

      carpetas.forEach(c => {
        if (c.es_autor_intelectual) {
          totalPuntosPosibles++;
          if (caseGuesses[c.id]?.autorIntelectual === 'si' || Object.values(groupGuesses).some(g => g.autorIntelectual === c.id)) {
            puntosObtenidos++;
            autorCorrectoCount++;
          }
        }
        if (c.es_zona_operacion) {
          totalPuntosPosibles++;
          if (caseGuesses[c.id]?.zonaOperacion === 'si' || Object.values(groupGuesses).some(g => g.zonaOperacion === c.id)) {
            puntosObtenidos++;
            zonaCorrectaCount++;
          }
        }
      });

      const score = Math.round((puntosObtenidos / Math.max(1, totalPuntosPosibles)) * 100);

      const objetivosData = {
        autorCorrecto: autorCorrectoCount > 0,
        zonaCorrecta: zonaCorrectaCount > 0,
        puntajeExtra: 0
      };
      setObjetivosFeedback(objetivosData);

      setValidationResult({
        expectedTotal: expectedPairs.size,
        userTotal: userPairs.size,
        score,
        correct,
        incorrect,
        missing,
      });
      setElapsedSeconds(Math.floor((Date.now() - startTimestamp) / 1000));
      setInvestigationFinished(true);
      setSelectedNodeIds([]);
      setIsFeedbackModalOpen(true);

      const groupJustifications = {};
      Object.entries(groupMeta).forEach(([k, meta]) => {
        if (meta.justificacionGeneral) {
          groupJustifications[k] = meta.justificacionGeneral;
        }
      });

      await saveInitialFeedback({
        expectedTotal: expectedPairs.size,
        userTotal: userPairs.size,
        score,
        correct,
        incorrect,
        missing,
        caseGuesses,
        groupGuesses,
        groupJustifications,
      });
    } catch (requestError) {
      console.error('Error finishing investigation:', requestError);
      setError('No fue posible validar la investigacion en este momento.');
    } finally {
      setFinishing(false);
    }
  };

  const restartInvestigation = () => {
    if (validationResult || feedbackSubmitted) {
      setError('La prueba ya fue presentada. No se puede reiniciar.');
      return;
    }

    setConnections([]);
    setSelectedNodeIds([]);
    setFinalizedGroups({});
    setValidationResult(null);
    setObjetivosFeedback(null);
    setDisagreementReasons({});
    setInvestigationFinished(false);
    setStartTimestamp(Date.now());
    setElapsedSeconds(0);
    setAutorIntelectualGuess('');
    setZonaOperacionGuess('');
  };

  const updateDisagreement = (pairKey, text) => {
    setDisagreementReasons((current) => ({ ...current, [pairKey]: text }));
  };

  return (
    <div className="flex h-screen flex-col bg-investigation-bg text-slate-100">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-600/30 bg-slate-950/80 px-6 py-3">
        <div className="flex items-center gap-8">
          <h1 className="font-mono text-lg tracking-[0.18em] text-cyan-200">MODO INVESTIGADOR</h1>
          <nav className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('tablero')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === 'tablero' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              Tablero Analítico
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('casos')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === 'casos' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              Gestión de Casos
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-slate-400">{usuario?.nombre ? `Sesión: ${usuario.nombre}` : 'Sesión activa'}</p>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'tablero' ? (
          <>
            <aside className="w-[360px] border-r border-slate-600/30 bg-slate-950/70 p-4">

          <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-cyan-200">
                <FiClock size={15} />
                Tiempo Restante
              </div>
            </div>
            <p className={`mt-1 font-mono text-xl ${(tiempoLimiteMinutos * 60 - elapsedSeconds) < 60 ? 'text-orange-400 animate-pulse' : 'text-slate-100'}`}>
              {formatSeconds(Math.max(0, tiempoLimiteMinutos * 60 - elapsedSeconds))}
            </p>
          </div>

        </aside>

        <main className="flex-1 p-4">
          <div className="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto]">
            <div className="rounded-lg border border-slate-500/20 bg-slate-950/50 px-4 py-3">
              <p className="text-sm text-slate-300">
                Conecta esferas para crear hipotesis investigativas. Cada componente conectado se convierte en un grupo.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={finishInvestigation}
                disabled={finishing || investigationFinished || feedbackChecking || feedbackSubmitted || Boolean(validationResult)}
                className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-60"
              >
                <FiTarget size={15} />
                {finishing ? 'Validando...' : 'Terminar investigacion'}
              </button>
              <button
                type="button"
                onClick={restartInvestigation}
                disabled={feedbackSubmitted || Boolean(validationResult)}
                className="flex items-center gap-2 rounded-lg border border-slate-500/30 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700/40"
              >
                <FiPlay size={14} />
                Reiniciar
              </button>
              <button
                type="button"
                onClick={() => setIsFeedbackModalOpen(true)}
                disabled={!validationResult}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-60"
              >
                Ver feedback
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="grid h-[calc(100%-56px)] grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
            <div ref={boardRef} className="relative h-full overflow-hidden rounded-xl border border-cyan-500/20 bg-slate-950/60">
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {groupedRegions.map((region) => (
                  <g key={region.key}>
                    <rect
                      x={region.x}
                      y={region.y}
                      width={region.width}
                      height={region.height}
                      rx="28"
                      ry="28"
                      fill={hexToRgba(region.color, 0.06)}
                      stroke={hexToRgba(region.color, 0.45)}
                      strokeDasharray="8 6"
                      strokeWidth="1.5"
                    />
                    <text
                      x={region.x + 18}
                      y={region.y + 26}
                      fill={region.color}
                      fontSize="13"
                      fontWeight="700"
                      letterSpacing="0.14em"
                    >
                      {region.name.toUpperCase()}
                    </text>
                  </g>
                ))}

                {activeConnections.map((edge) => {
                  const source = activeNodeById.get(edge.a);
                  const target = activeNodeById.get(edge.b);
                  if (!source || !target) {
                    return null;
                  }
                  const pairKey = getPairKey(edge.a, edge.b);
                  return (
                    <line
                      key={pairKey}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke="#38bdf8"
                      strokeWidth="2"
                      opacity="0.75"
                    />
                  );
                })}
              </svg>

              {activeNodes.map((node) => (
                (() => {
                  const metadata = caseMetadataById.get(node.id);
                  return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onNodeClick(node.id)}
                  title={`${metadata?.offenseType || 'Caso'} | ${metadata?.caseDateLabel || 'Sin fecha'} | ${metadata?.zone || 'Sin zona'}`}
                  className={`absolute flex h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-center text-[10px] font-semibold leading-tight transition ${
                    (() => {
                      const group = groupedRegions.find((region) => region.ids.includes(node.id));
                      const groupColor = group ? group.color : GROUP_COLOR_PALETTE[0];
                      if (selectedNodeIds.includes(node.id)) {
                        return 'border-emerald-300 bg-emerald-500/20 text-emerald-100 shadow-[0_0_22px_rgba(16,185,129,0.35)]';
                      }

                      return 'text-white hover:brightness-110';
                    })()
                  }`}
                  style={{
                    left: node.x,
                    top: node.y,
                    backgroundColor: (() => {
                      const group = groupedRegions.find((region) => region.ids.includes(node.id));
                      const groupColor = group ? group.color : GROUP_COLOR_PALETTE[0];
                      return selectedNodeIds.includes(node.id) ? 'rgba(16, 185, 129, 0.20)' : hexToRgba(groupColor, 0.22);
                    })(),
                    borderColor: (() => {
                      const group = groupedRegions.find((region) => region.ids.includes(node.id));
                      const groupColor = group ? group.color : GROUP_COLOR_PALETTE[0];
                      return selectedNodeIds.includes(node.id) ? '#a7f3d0' : hexToRgba(groupColor, 0.55);
                    })(),
                    boxShadow: (() => {
                      const group = groupedRegions.find((region) => region.ids.includes(node.id));
                      const groupColor = group ? group.color : GROUP_COLOR_PALETTE[0];
                      return selectedNodeIds.includes(node.id)
                        ? '0 0 22px rgba(16,185,129,0.35)'
                        : `0 0 18px ${hexToRgba(groupColor, 0.18)}`;
                    })(),
                  }}
                >
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border border-slate-900 bg-cyan-400/90 text-[9px] font-bold text-slate-900">
                    {metadata?.offenseTag || 'C'}
                  </span>
                  <span className="line-clamp-3 px-1">{node.label}</span>
                </button>
                  );
                })()
              ))}
            </div>

            <div className="h-full space-y-3 overflow-y-auto rounded-xl border border-slate-500/20 bg-slate-950/60 p-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Conexiones ({activeConnections.length})</p>
                <div className="mt-2 space-y-1">
                  {activeConnections.length === 0 ? (
                    <p className="text-xs text-slate-400">Aun no hay enlaces creados.</p>
                  ) : (
                    activeConnections.map((edge) => {
                      const key = getPairKey(edge.a, edge.b);
                      const source = carpetas.find((caseItem) => caseItem.id === edge.a);
                      const target = carpetas.find((caseItem) => caseItem.id === edge.b);
                      return (
                        <div key={key} className="flex items-center justify-between rounded border border-slate-500/20 bg-slate-900/70 px-2 py-1 text-xs">
                          <span className="text-slate-200">
                            {source?.nombre || edge.a} - {target?.nombre || edge.b}
                          </span>
                          {!investigationFinished && (
                            <button
                              type="button"
                              onClick={() => removeConnection(key)}
                              className="text-red-300 hover:text-red-200"
                            >
                              quitar
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Grupos detectados</p>
                <div className="mt-2 space-y-2">
                  {componentsWithMeta.length === 0 ? (
                    <p className="text-xs text-slate-400">Selecciona hasta 3 casos para crear un grupo completo.</p>
                  ) : (
                    componentsWithMeta.map((group) => (
                      <div
                        key={group.key}
                        className="rounded border p-2"
                        style={{
                          borderColor: hexToRgba(group.color, 0.35),
                          backgroundColor: hexToRgba(group.color, 0.12),
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            disabled={investigationFinished}
                            value={groupMeta[group.key]?.color || group.color}
                            onChange={(event) => updateGroupMeta(group.key, { color: event.target.value })}
                            className="h-9 w-10 cursor-pointer rounded border border-slate-500/30 bg-transparent p-1"
                            aria-label={`Color del grupo ${groupMeta[group.key]?.name || group.name}`}
                          />
                          <div className="flex-1">
                            <input
                              type="text"
                              disabled={investigationFinished}
                              value={groupMeta[group.key]?.name || group.name}
                              onChange={(event) => updateGroupMeta(group.key, { name: event.target.value })}
                              className="w-full rounded border border-slate-500/20 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 outline-none"
                              placeholder="Nombre del grupo"
                            />
                            <select
                              disabled={investigationFinished || Boolean(finalizedGroups[group.key])}
                              value={groupMeta[group.key]?.relationType || group.relationType}
                              onChange={(event) => updateGroupMeta(group.key, { relationType: event.target.value })}
                              className="mt-1 w-full rounded border border-slate-500/20 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 outline-none"
                            >
                              <option value="modalidad">Asociado por modalidad</option>
                              <option value="patrones">Asociado por patron</option>
                            </select>

                            <select
                              disabled={investigationFinished}
                              value={groupGuesses[group.key]?.autorIntelectual || ''}
                              onChange={(e) => setGroupGuesses(prev => ({ ...prev, [group.key]: { ...prev[group.key], autorIntelectual: e.target.value } }))}
                              className="mt-1 w-full rounded border border-slate-500/20 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 outline-none"
                            >
                              <option value="">¿Autor Intelectual General?</option>
                              {carpetas.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                              ))}
                            </select>

                            <select
                              disabled={investigationFinished}
                              value={groupGuesses[group.key]?.zonaOperacion || ''}
                              onChange={(e) => setGroupGuesses(prev => ({ ...prev, [group.key]: { ...prev[group.key], zonaOperacion: e.target.value } }))}
                              className="mt-1 w-full rounded border border-slate-500/20 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 outline-none"
                            >
                              <option value="">¿Zona de Operación General?</option>
                              {carpetas.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                              ))}
                            </select>
                            
                            <textarea
                              disabled={investigationFinished}
                              value={groupMeta[group.key]?.justificacionGeneral || ''}
                              onChange={(e) => updateGroupMeta(group.key, { justificacionGeneral: e.target.value })}
                              placeholder="Justificación general del grupo..."
                              className="mt-1 h-14 w-full resize-none rounded border border-slate-500/20 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 outline-none"
                            />
                          </div>
                        </div>
                          <button
                            type="button"
                            onClick={() => finalizeGroup(group)}
                            disabled={investigationFinished || Boolean(finalizedGroups[group.key]) || !(groupMeta[group.key]?.justificacionGeneral?.trim())}
                            className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FiSave size={13} />
                            {finalizedGroups[group.key] ? 'Grupo finalizado' : 'Finalizar grupo'}
                          </button>

                          {finalizedGroups[group.key] && (() => {
                            const snapshot = finalizedGroups[group.key];
                            const layout = buildCompactGraphLayout(snapshot.nodes || snapshot.cases || []);
                            return (
                              <div className="mt-3 rounded-lg border border-emerald-400/20 bg-slate-950/60 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                                      Grafo finalizado
                                    </p>
                                    <p className="mt-1 text-[11px] text-slate-400">
                                      {snapshot.groupName || group.name} · {snapshot.relationType === 'patrones' ? 'Patrón' : 'Modalidad'}
                                    </p>
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    {layout.nodes.length} nodos / {snapshot.connections.length} conexiones
                                  </span>
                                </div>

                                <div className="mt-3 overflow-hidden rounded-xl border border-slate-500/20 bg-slate-950/80 p-2">
                                  <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="h-[170px] w-full">
                                    {snapshot.connections.map((edge) => {
                                      const source = layout.nodes.find((node) => String(node.id) === String(edge.sourceId));
                                      const target = layout.nodes.find((node) => String(node.id) === String(edge.targetId));
                                      if (!source || !target) {
                                        return null;
                                      }

                                      return (
                                        <line
                                          key={edge.key}
                                          x1={source.x}
                                          y1={source.y}
                                          x2={target.x}
                                          y2={target.y}
                                          stroke={snapshot.color || '#38bdf8'}
                                          strokeWidth="2"
                                          opacity="0.85"
                                        />
                                      );
                                    })}

                                    {layout.nodes.map((node) => (
                                      <g key={node.id}>
                                        <circle
                                          cx={node.x}
                                          cy={node.y}
                                          r="20"
                                          fill={hexToRgba(snapshot.color || '#38bdf8', 0.18)}
                                          stroke={hexToRgba(snapshot.color || '#38bdf8', 0.65)}
                                          strokeWidth="1.5"
                                        />
                                        <text
                                          x={node.x}
                                          y={node.y - 25}
                                          textAnchor="middle"
                                          fill="#e2e8f0"
                                          fontSize="9"
                                          fontWeight="700"
                                        >
                                          {String(node.name || '').slice(0, 12)}
                                        </text>
                                        <text
                                          x={node.x}
                                          y={node.y + 3}
                                          textAnchor="middle"
                                          fill="#e2e8f0"
                                          fontSize="8"
                                          fontWeight="700"
                                        >
                                          {String(node.name || '').slice(0, 10)}
                                        </text>
                                      </g>
                                    ))}
                                  </svg>
                                </div>
                              </div>
                            );
                          })()}

                        <p className="mt-2 text-[11px]" style={{ color: hexToRgba(group.color, 0.9) }}>
                          {group.ids.length} casos conectados
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {validationResult && (
                <div className="space-y-2 border-t border-slate-600/30 pt-2">
                  <div className="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    Esta prueba ya fue presentada. Puedes revisar el resultado en el modal y descargar tu PDF.
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFeedbackModalOpen(true)}
                    className="w-full rounded border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                  >
                    Abrir feedback
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950/40">
            <div className="mx-auto max-w-6xl">
              <h2 className="mb-6 text-2xl font-bold text-cyan-400">Gestión General de Casos</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {carpetas.map((caseItem) => {
                  const meta = caseMetadataById.get(caseItem.id);
                  const isIntellectual = caseGuesses[caseItem.id]?.autorIntelectual || '';
                  const opZone = caseGuesses[caseItem.id]?.zonaOperacion || '';
                  return (
                    <div key={caseItem.id} className="rounded-xl border border-slate-600/30 bg-slate-900/80 p-5 shadow-lg">
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-semibold text-cyan-200">{caseItem.nombre}</h3>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCaseId(caseItem.id);
                            setIsCaseSummaryOpen(true);
                          }}
                          className="text-xs text-cyan-400 underline hover:text-cyan-300"
                        >
                          Ver Detalles
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{meta?.offenseType || 'Sin delito'}</p>
                      <p className="text-xs text-slate-400">{meta?.caseDateLabel || 'Sin fecha'} - {meta?.zone || 'Sin zona'}</p>

                      <div className="mt-5 space-y-4 border-t border-slate-700/50 pt-4">
                        <div>
                          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">¿Es el Autor Intelectual?</label>
                          <select
                            disabled={investigationFinished}
                            value={isIntellectual}
                            onChange={(e) => setCaseGuesses(prev => ({ ...prev, [caseItem.id]: { ...prev[caseItem.id], autorIntelectual: e.target.value } }))}
                            className="mt-1 w-full rounded border border-slate-600/50 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                          >
                            <option value="">No definido</option>
                            <option value="si">Sí, es autor intelectual</option>
                            <option value="no">No lo es</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">¿Es la Zona de Operación Principal?</label>
                          <select
                            disabled={investigationFinished}
                            value={opZone}
                            onChange={(e) => setCaseGuesses(prev => ({ ...prev, [caseItem.id]: { ...prev[caseItem.id], zonaOperacion: e.target.value } }))}
                            className="mt-1 w-full rounded border border-slate-600/50 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                          >
                            <option value="">No definido</option>
                            <option value="si">Sí, es la zona de operación</option>
                            <option value="no">No lo es</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {pendingConnections.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-5 shadow-[0_0_45px_rgba(8,145,178,0.28)]">
            <h2 className="mb-2 text-xl font-bold text-cyan-400">Justificar Conexión(es)</h2>
            <p className="mb-4 text-xs text-slate-300">
              Has trazado {pendingConnections.length} conexión(es) entre los casos:
            </p>
            <ul className="mb-4 max-h-32 overflow-y-auto pl-4 text-xs text-cyan-200">
              {pendingConnections.map((edge) => (
                <li key={getPairKey(edge.a, edge.b)} className="mb-1 list-disc">
                  <span className="font-semibold">{caseNameById.get(edge.a)}</span> - <span className="font-semibold">{caseNameById.get(edge.b)}</span>
                </li>
              ))}
            </ul>
            <textarea
              value={justificationText}
              onChange={(e) => setJustificationText(e.target.value)}
              className="h-24 w-full resize-none rounded-lg border border-slate-500/30 bg-slate-800 p-3 text-sm text-slate-200 outline-none focus:border-cyan-400"
              placeholder="Escribe por qué crees que estos casos están conectados..."
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setPendingConnections([]);
                  setJustificationText('');
                  setSelectedNodeIds([]);
                }}
                className="rounded-lg border border-slate-500/30 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700/40"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={justificationText.trim().length === 0}
                onClick={() => {
                  setConnections((current) => [...current, ...pendingConnections]);
                  setConnectionJustifications(prev => {
                    const next = { ...prev };
                    pendingConnections.forEach(edge => {
                      const key = getPairKey(edge.a, edge.b);
                      next[key] = justificationText.trim();
                    });
                    return next;
                  });
                  setPendingConnections([]);
                  setJustificationText('');
                  setSelectedNodeIds([]);
                }}
                className="rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-4 py-2 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/30 disabled:opacity-50"
              >
                Conectar Casos
              </button>
            </div>
          </div>
        </div>
      )}

      {isFeedbackModalOpen && validationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-5 shadow-[0_0_45px_rgba(8,145,178,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Feedback Final</p>
                <p className="mt-1 font-mono text-lg text-slate-100">{usuario?.nombre || 'Investigador'}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFeedbackModalOpen(false)}
                className="rounded-lg border border-slate-500/30 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-700/40"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <div className="rounded border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                Puntaje: {validationResult.score}%
              </div>
              <div className="rounded border border-slate-500/20 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
                Esperadas: {validationResult.expectedTotal} | Trazadas: {validationResult.userTotal}
              </div>
              <div className="rounded border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
                Formula: correctas ({validationResult.correct.length}) / esperadas ({validationResult.expectedTotal})
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                  <FiCheckCircle className="mr-1 inline" size={12} />
                  Correctas: {validationResult.correct.length}
                </div>
                <div className="rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  <FiXCircle className="mr-1 inline" size={12} />
                  Incorrectas: {validationResult.incorrect.length}
                </div>
                <div className="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  <FiLink className="mr-1 inline" size={12} />
                  Faltantes: {validationResult.missing.length}
                </div>
              </div>
            </div>

            {objetivosFeedback && (
              <div className="mt-4 rounded border border-orange-500/30 bg-orange-500/10 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-orange-200">Resultados Misiones Estratégicas</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded px-3 py-2 text-xs ${objetivosFeedback.autorCorrecto ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'}`}>
                    Autor Intelectual: {objetivosFeedback.autorCorrecto ? '¡Acertado!' : 'Fallido'}
                  </div>
                  <div className={`rounded px-3 py-2 text-xs ${objetivosFeedback.zonaCorrecta ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'}`}>
                    Zona Operación: {objetivosFeedback.zonaCorrecta ? '¡Acertado!' : 'Fallida'}
                  </div>
                </div>
              </div>
            )}

            {validationResult.missing.length > 0 && (
              <div className="mt-4 space-y-1 rounded border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-sm text-amber-200">Conexiones esperadas que faltaron:</p>
                {validationResult.missing.map((pairKey) => (
                  <p key={pairKey} className="text-xs text-amber-100">
                    {formatPairLabel(pairKey, caseNameById)}
                  </p>
                ))}
              </div>
            )}

            {validationResult.incorrect.length > 0 && (
              <div className="mt-4 space-y-2 rounded border border-slate-500/20 bg-slate-900/70 p-3">
                <p className="text-sm text-slate-300">
                  Si no estas de acuerdo con una conexion marcada como incorrecta, registra tu justificacion:
                </p>
                {validationResult.incorrect.map((pairKey) => (
                  <div key={pairKey}>
                    <p className="text-xs text-slate-400">Conexion: {formatPairLabel(pairKey, caseNameById)}</p>
                    <textarea
                      rows="2"
                      value={disagreementReasons[pairKey] || ''}
                      onChange={(event) => updateDisagreement(pairKey, event.target.value)}
                      className="mt-1 w-full rounded border border-slate-500/20 bg-slate-950/70 px-2 py-1 text-xs text-slate-200 outline-none"
                      placeholder="Explica por que consideras valida esta conexion..."
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveJustifications}
                disabled={!feedbackSubmitted || savingJustifications}
                className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-60"
              >
                <FiSave size={14} />
                {savingJustifications ? 'Guardando...' : 'Guardar justificaciones'}
              </button>
              <button
                type="button"
                onClick={downloadFeedbackPdf}
                disabled={!validationResult}
                className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60"
              >
                <FiDownload size={14} />
                Descargar PDF
              </button>
              {savingFeedback && (
                <span className="text-xs text-slate-400">Guardando feedback inicial...</span>
              )}
            </div>
          </div>
        </div>
      )}

      {isCaseSummaryOpen && selectedCase && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900/95 shadow-[0_0_50px_rgba(8,145,178,0.28)]">
            <div className="flex items-center justify-between border-b border-slate-500/20 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Vista general</p>
                <p className="mt-1 font-mono text-lg text-slate-100">{selectedCase.nombre}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCaseSummaryOpen(false);
                  setSelectedCaseId(null);
                  setSelectedDocument(null);
                }}
                className="rounded-lg border border-slate-500/30 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-700/40"
              >
                Cerrar
              </button>
            </div>

            <div className="grid max-h-[calc(92vh-73px)] grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[340px_1fr]">
              <div className="border-b border-slate-500/20 bg-slate-950/60 p-5 lg:border-b-0 lg:border-r">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Resumen</p>
                <p className="mt-2 text-sm text-slate-200">{selectedCase.descripcion || 'Sin descripcion.'}</p>

                <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Metadatos del caso</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-200">
                    <p className="flex items-center gap-2">
                      <FiAlertTriangle size={12} className="text-amber-300" />
                      Tipo de delito: {selectedCaseMetadata?.offenseType || 'Sin registrar'}
                    </p>
                    <p className="flex items-center gap-2">
                      <FiCalendar size={12} className="text-cyan-300" />
                      Fecha del caso: {selectedCaseMetadata?.caseDateLabel || 'Sin fecha'}
                    </p>
                    <p className="flex items-center gap-2">
                      <FiUsers size={12} className="text-emerald-300" />
                      Victima-victimario: {selectedCaseMetadata?.victim || 'Sin registrar'} / {selectedCaseMetadata?.offender || 'Sin registrar'}
                    </p>
                    <p className="flex items-center gap-2">
                      <FiMapPin size={12} className="text-fuchsia-300" />
                      Zona territorial: {selectedCaseMetadata?.zone || 'Sin registrar'}
                    </p>
                  </div>

                  <div className="mt-3">
                    <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-slate-300/80">
                      <FiShield size={12} className="text-cyan-200" />
                      Actores involucrados
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(selectedCaseMetadata?.actors || []).map((actor, actorIndex) => (
                        <span
                          key={`${selectedCase?.id}-${actor}`}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-500/30 px-2 py-1 text-[11px] text-slate-100"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: ACTOR_BADGE_COLORS[actorIndex % ACTOR_BADGE_COLORS.length] }}
                          />
                          {actor}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-500/20 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Documentos</p>
                  {loadingDocuments ? (
                    <p className="mt-3 text-xs text-slate-400">Cargando documentos...</p>
                  ) : selectedCaseDocuments.length === 0 ? (
                    <p className="mt-3 text-xs text-slate-400">No hay documentos en esta carpeta.</p>
                  ) : (
                    <div className="mt-3 max-h-[48vh] space-y-2 overflow-y-auto pr-1">
                      {selectedCaseDocuments.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => setSelectedDocument(doc)}
                          className={`w-full rounded-lg border px-3 py-3 text-left text-xs transition ${
                            selectedDocument?.id === doc.id
                              ? 'border-cyan-400/60 bg-cyan-500/10'
                              : 'border-slate-500/20 bg-slate-950/50 hover:border-cyan-400/30'
                          }`}
                        >
                          <p className="flex items-center gap-2 text-slate-100">
                            <FiFileText size={12} />
                            {doc.nombre}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">Haz clic para ver la preview</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-h-[56vh] flex-col bg-slate-950/80 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Preview</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {selectedDocument ? selectedDocument.nombre : 'Selecciona un documento para ampliarlo.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex-1 overflow-hidden rounded-xl border border-cyan-500/20 bg-slate-900/60">
                  {selectedDocument ? (
                    getPdfViewerSrc(selectedDocument.archivo_url) ? (
                      <iframe
                        title={`preview-${selectedDocument.id}`}
                        src={getPdfViewerSrc(selectedDocument.archivo_url)}
                        className="h-full min-h-[62vh] w-full border-0 bg-white"
                      />
                    ) : (
                      <div className="flex h-full min-h-[62vh] items-center justify-center px-6 text-center">
                        <p className="text-sm text-slate-400">Solo se admite preview PDF.</p>
                      </div>
                    )
                  ) : (
                    <div className="flex h-full min-h-[62vh] items-center justify-center px-6 text-center">
                      <p className="text-sm text-slate-400">Elige un documento para ver una vista ampliada.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardInvestigator;