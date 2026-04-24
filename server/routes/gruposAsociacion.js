const express = require('express');
const pool = require('../db');

const router = express.Router();

const verificarToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  next();
};

const ordenarPar = (a, b) => {
  return String(a).localeCompare(String(b)) <= 0 ? [a, b] : [b, a];
};

router.get('/', verificarToken, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ga.id,
        ga.nombre,
        ga.patron_criminal,
        ga.justificacion_general,
        ga.created_at,
        u.nombre AS created_by_nombre,
        COUNT(DISTINCT gac.carpeta_id) AS cantidad_casos,
        COUNT(DISTINCT gar.id) AS cantidad_relaciones,
        COUNT(DISTINCT gae.id) AS cantidad_exclusiones
      FROM grupos_asociacion ga
      LEFT JOIN usuarios u ON ga.created_by = u.id
      LEFT JOIN grupos_asociacion_casos gac ON ga.id = gac.grupo_id
      LEFT JOIN grupos_asociacion_relaciones gar ON ga.id = gar.grupo_id
      LEFT JOIN grupos_asociacion_exclusiones gae ON ga.id = gae.grupo_id
      GROUP BY ga.id, u.nombre
      ORDER BY ga.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo grupos de asociación:', error);
    res.status(500).json({ error: 'Error obteniendo grupos de asociación' });
  }
});

router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const grupoResult = await pool.query(
      `
      SELECT
        ga.id,
        ga.nombre,
        ga.patron_criminal,
        ga.justificacion_general,
        ga.created_at,
        u.nombre AS created_by_nombre
      FROM grupos_asociacion ga
      LEFT JOIN usuarios u ON ga.created_by = u.id
      WHERE ga.id = $1
      `,
      [id]
    );

    if (grupoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    const casosResult = await pool.query(
      `
      SELECT
        gac.carpeta_id,
        c.nombre,
        c.descripcion,
        c.imagen_url
      FROM grupos_asociacion_casos gac
      JOIN carpetas c ON gac.carpeta_id = c.id
      WHERE gac.grupo_id = $1
      ORDER BY c.nombre ASC
      `,
      [id]
    );

    const relacionesResult = await pool.query(
      `
      SELECT
        gar.id,
        gar.carpeta_a_id,
        gar.carpeta_b_id,
        gar.relation_type,
        gar.relation_type,
        gar.justificacion,
        ca.nombre AS carpeta_a_nombre,
        cb.nombre AS carpeta_b_nombre
      FROM grupos_asociacion_relaciones gar
      JOIN carpetas ca ON gar.carpeta_a_id = ca.id
      JOIN carpetas cb ON gar.carpeta_b_id = cb.id
      WHERE gar.grupo_id = $1
      ORDER BY gar.created_at ASC
      `,
      [id]
    );

    const exclusionesResult = await pool.query(
      `
      SELECT
        gae.id,
        gae.carpeta_id,
        gae.justificacion_no_relacion,
        c.nombre AS carpeta_nombre
      FROM grupos_asociacion_exclusiones gae
      JOIN carpetas c ON gae.carpeta_id = c.id
      WHERE gae.grupo_id = $1
      ORDER BY c.nombre ASC
      `,
      [id]
    );

    res.json({
      grupo: grupoResult.rows[0],
      casos: casosResult.rows,
      relaciones: relacionesResult.rows,
      exclusiones: exclusionesResult.rows,
    });
  } catch (error) {
    console.error('Error obteniendo detalle del grupo:', error);
    res.status(500).json({ error: 'Error obteniendo detalle del grupo' });
  }
});

router.get('/caso/:carpeta_id', verificarToken, async (req, res) => {
  try {
    const { carpeta_id } = req.params;
    const result = await pool.query(
      `
      SELECT
        ga.id,
        ga.nombre,
        ga.patron_criminal,
        ga.justificacion_general,
        ga.created_at,
        u.nombre AS created_by_nombre
      FROM grupos_asociacion ga
      JOIN grupos_asociacion_casos gac ON ga.id = gac.grupo_id
      LEFT JOIN usuarios u ON ga.created_by = u.id
      WHERE gac.carpeta_id = $1
      GROUP BY ga.id, u.nombre
      ORDER BY ga.created_at DESC
      `,
      [carpeta_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo grupos del caso:', error);
    res.status(500).json({ error: 'Error obteniendo grupos del caso' });
  }
});

router.post('/', verificarToken, async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const {
      nombre,
      justificacion_general,
      patron_criminal,
      usuario_id,
      casos = [],
      relaciones = [],
      exclusiones = [],
    } = req.body;

    if (!nombre || !justificacion_general || !usuario_id || !patron_criminal) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        valido: false,
        razon: 'Debes indicar nombre del grupo, patron criminal, justificacion general y usuario_id.',
      });
    }

    const casoIds = [...new Set(casos.map((caso) => caso.carpeta_id).filter(Boolean))];

    if (casoIds.length < 2) {
      return res.status(400).json({
        error: 'Se requieren al menos dos casos',
        valido: false,
        razon: 'Selecciona al menos dos casos para crear un grupo de asociación.',
      });
    }

    const allCasesResult = await client.query('SELECT id FROM carpetas');
    const allCaseIds = allCasesResult.rows.map((row) => row.id);
    const selectedSet = new Set(casoIds);
    const unselectedCaseIds = allCaseIds.filter((id) => !selectedSet.has(id));

    const exclusionMap = new Map();
    for (const exclusion of exclusiones) {
      const caseId = exclusion.carpeta_id;
      const justificacion = String(exclusion.justificacion_no_relacion || '').trim();
      if (!caseId || !unselectedCaseIds.includes(caseId)) {
        return res.status(400).json({
          error: 'Exclusión inválida',
          valido: false,
          razon: 'Se envió una exclusión para un caso seleccionado o inexistente.',
        });
      }
      if (justificacion.length < 15) {
        return res.status(400).json({
          error: 'Justificación de exclusión insuficiente',
          valido: false,
          razon: 'Cada caso no seleccionado debe tener una justificación detallada (mínimo 15 caracteres).',
        });
      }
      exclusionMap.set(caseId, justificacion);
    }

    for (const caseId of unselectedCaseIds) {
      if (!exclusionMap.has(caseId)) {
        return res.status(400).json({
          error: 'Faltan justificaciones de no relación',
          valido: false,
          razon: 'Debes justificar por qué cada caso no seleccionado no pertenece al grupo.',
        });
      }
    }

    const pairKeys = new Map();
    for (let i = 0; i < casoIds.length; i += 1) {
      for (let j = i + 1; j < casoIds.length; j += 1) {
        const [a, b] = ordenarPar(casoIds[i], casoIds[j]);
        pairKeys.set(`${a}__${b}`, null);
      }
    }

    for (const relacion of relaciones) {
      const [a, b] = ordenarPar(relacion.carpeta_a_id, relacion.carpeta_b_id);
      const key = `${a}__${b}`;
      if (!pairKeys.has(key)) {
        return res.status(400).json({
          error: 'Relación inválida',
          valido: false,
          razon: 'Se envió una relación que no pertenece al grupo seleccionado.',
        });
      }
      const justificacion = String(relacion.justificacion || '').trim();
      if (justificacion.length < 15) {
        return res.status(400).json({
          error: 'Justificación insuficiente',
          valido: false,
          razon: 'Cada relación de par debe tener una justificación más detallada.',
        });
      }
      const relationType = String(relacion.relation_type || '').trim();
      if (!['modalidad', 'patrones'].includes(relationType)) {
        return res.status(400).json({
          error: 'Tipo de relación inválido',
          valido: false,
          razon: 'Cada par debe indicar si se asocia por Modalidad o por Patrón.',
        });
      }
      pairKeys.set(key, { justificacion, relationType });
    }

    for (const [key, relationInfo] of pairKeys.entries()) {
      if (!relationInfo) {
        return res.status(400).json({
          error: 'Faltan justificaciones',
          valido: false,
          razon: `Falta justificar la relación ${key.replace('__', ' - ')}.`,
        });
      }
    }

    await client.query('BEGIN');
    transactionStarted = true;

    // Asegurarse de que la columna existe (si no se corrió migracion por CLI)
    await client.query(`ALTER TABLE grupos_asociacion ADD COLUMN IF NOT EXISTS patron_criminal VARCHAR(255) DEFAULT '';`);

    const grupoResult = await client.query(
      `
      INSERT INTO grupos_asociacion (nombre, patron_criminal, justificacion_general, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [nombre, patron_criminal, justificacion_general, usuario_id]
    );

    const grupoId = grupoResult.rows[0].id;

    for (const carpetaId of casoIds) {
      await client.query(
        `
        INSERT INTO grupos_asociacion_casos (grupo_id, carpeta_id)
        VALUES ($1, $2)
        `,
        [grupoId, carpetaId]
      );
    }

    for (const [key, relationInfo] of pairKeys.entries()) {
      const [carpeta_a_id, carpeta_b_id] = key.split('__');
      await client.query(
        `
        INSERT INTO grupos_asociacion_relaciones
          (grupo_id, carpeta_a_id, carpeta_b_id, relation_type, justificacion, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [grupoId, carpeta_a_id, carpeta_b_id, relationInfo.relationType, relationInfo.justificacion, usuario_id]
      );
    }

    for (const [carpetaId, justificacionNoRelacion] of exclusionMap.entries()) {
      await client.query(
        `
        INSERT INTO grupos_asociacion_exclusiones
          (grupo_id, carpeta_id, justificacion_no_relacion, created_by)
        VALUES ($1, $2, $3, $4)
        `,
        [grupoId, carpetaId, justificacionNoRelacion, usuario_id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      valido: true,
      grupo: grupoResult.rows[0],
      cantidad_casos: casoIds.length,
      cantidad_relaciones: pairKeys.size,
      cantidad_exclusiones: exclusionMap.size,
      razon: 'Grupo de asociación creado correctamente.',
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    console.error('Error creando grupo de asociación:', error);
    res.status(500).json({ error: 'Error creando grupo de asociación' });
  } finally {
    client.release();
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const result = await client.query(
      'DELETE FROM grupos_asociacion WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    await client.query('COMMIT');
    res.json({ mensaje: 'Grupo eliminado', grupo: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error eliminando grupo de asociación:', error);
    res.status(500).json({ error: 'Error eliminando grupo de asociación' });
  } finally {
    client.release();
  }
});

module.exports = router;
