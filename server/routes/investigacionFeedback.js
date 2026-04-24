const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'prisma_secret_key_2026';

let schemaReady = false;

const ensureSchema = async () => {
  if (schemaReady) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS evaluaciones_investigador (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      usuario_id UUID UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      usuario_nombre VARCHAR(120),
      puntaje INTEGER NOT NULL DEFAULT 0,
      expected_total INTEGER NOT NULL DEFAULT 0,
      user_total INTEGER NOT NULL DEFAULT 0,
      correct_pairs JSONB NOT NULL DEFAULT '[]'::jsonb,
      incorrect_pairs JSONB NOT NULL DEFAULT '[]'::jsonb,
      missing_pairs JSONB NOT NULL DEFAULT '[]'::jsonb,
      resuelto BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS evaluacion_justificaciones (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      evaluacion_id UUID NOT NULL REFERENCES evaluaciones_investigador(id) ON DELETE CASCADE,
      pair_key TEXT NOT NULL,
      pair_label TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (evaluacion_id, pair_key)
    );
  `);

  await pool.query(`
    ALTER TABLE evaluaciones_investigador
    ADD COLUMN IF NOT EXISTS resuelto BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE evaluaciones_investigador
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE evaluaciones_investigador
    ADD COLUMN IF NOT EXISTS plan_accion JSONB NOT NULL DEFAULT '[]'::jsonb;

    ALTER TABLE evaluaciones_investigador
    ADD COLUMN IF NOT EXISTS case_guesses JSONB NOT NULL DEFAULT '{}'::jsonb;

    ALTER TABLE evaluaciones_investigador
    ADD COLUMN IF NOT EXISTS group_guesses JSONB NOT NULL DEFAULT '{}'::jsonb;

    ALTER TABLE evaluaciones_investigador
    ADD COLUMN IF NOT EXISTS group_justifications JSONB NOT NULL DEFAULT '{}'::jsonb;

    CREATE TABLE IF NOT EXISTS investigacion_borradores (
      usuario_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
      estado_json JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  schemaReady = true;
};

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administradores' });
  }
  return next();
};

const mapFeedbackResponse = (feedback, justificaciones) => ({
  id: feedback.id,
  usuario_id: feedback.usuario_id,
  usuario_nombre: feedback.usuario_nombre,
  score: feedback.puntaje,
  expectedTotal: feedback.expected_total,
  userTotal: feedback.user_total,
  correct: feedback.correct_pairs || [],
  incorrect: feedback.incorrect_pairs || [],
  missing: feedback.missing_pairs || [],
  resuelto: Boolean(feedback.resuelto),
  planAccion: feedback.plan_accion || [],
  justificaciones: justificaciones || [],
  createdAt: feedback.created_at,
});

const fetchJustificaciones = async (feedbackId) => {
  const result = await pool.query(
    `
    SELECT pair_key, pair_label, reason, created_at, updated_at
    FROM evaluacion_justificaciones
    WHERE evaluacion_id = $1
    ORDER BY created_at ASC
    `,
    [feedbackId]
  );

  return result.rows;
};

router.get('/me', authenticate, async (req, res) => {
  try {
    await ensureSchema();

    const feedbackResult = await pool.query(
      'SELECT * FROM evaluaciones_investigador WHERE usuario_id = $1 LIMIT 1',
      [req.user.id]
    );

    if (feedbackResult.rows.length === 0 || !feedbackResult.rows[0].resuelto) {
      return res.json({ hasSubmitted: false });
    }

    const feedback = feedbackResult.rows[0];
    const justificaciones = await fetchJustificaciones(feedback.id);

    return res.json({
      hasSubmitted: true,
      feedback: mapFeedbackResponse(feedback, justificaciones),
    });
  } catch (error) {
    console.error('Error obteniendo feedback del investigador:', error);
    return res.status(500).json({ error: 'No fue posible obtener el feedback del investigador' });
  }
});

router.get('/me/draft', authenticate, async (req, res) => {
  try {
    await ensureSchema();
    const result = await pool.query(
      'SELECT estado_json FROM investigacion_borradores WHERE usuario_id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.json({ draft: null });
    }
    return res.json({ draft: result.rows[0].estado_json });
  } catch (error) {
    console.error('Error obteniendo borrador:', error);
    return res.status(500).json({ error: 'Error obteniendo borrador' });
  }
});

router.put('/me/draft', authenticate, async (req, res) => {
  try {
    await ensureSchema();
    const { estado_json } = req.body;
    
    if (!estado_json) {
      return res.status(400).json({ error: 'Estado JSON requerido' });
    }

    await pool.query(
      `
      INSERT INTO investigacion_borradores (usuario_id, estado_json, updated_at)
      VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (usuario_id) 
      DO UPDATE SET estado_json = $2::jsonb, updated_at = CURRENT_TIMESTAMP
      `,
      [req.user.id, JSON.stringify(estado_json)]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Error guardando borrador:', error);
    return res.status(500).json({ error: 'Error guardando borrador' });
  }
});

router.post('/', authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureSchema();

    const existingResult = await client.query(
      'SELECT * FROM evaluaciones_investigador WHERE usuario_id = $1 LIMIT 1',
      [req.user.id]
    );

    const {
      score = 0,
      expectedTotal = 0,
      userTotal = 0,
      correct = [],
      incorrect = [],
      missing = [],
      justificaciones = [],
      planAccion = [],
      caseGuesses = {},
      groupGuesses = {},
      groupJustifications = {},
    } = req.body || {};

    const cleanJustificaciones = (justificaciones || []).filter(
      (item) => String(item?.reason || '').trim().length > 0
    );

    if (existingResult.rows.length > 0 && existingResult.rows[0].resuelto) {
      const existingFeedback = existingResult.rows[0];
      const justificacionesRows = await fetchJustificaciones(existingFeedback.id);
      return res.status(409).json({
        error: 'La prueba ya fue presentada por este investigador',
        feedback: mapFeedbackResponse(existingFeedback, justificacionesRows),
      });
    }

    await client.query('BEGIN');

    let feedbackRow;

    if (existingResult.rows.length > 0) {
      const existingFeedback = existingResult.rows[0];
      const updatedResult = await client.query(
        `
        UPDATE evaluaciones_investigador
        SET
          usuario_nombre = $1,
          puntaje = $2,
          expected_total = $3,
          user_total = $4,
          correct_pairs = $5::jsonb,
          incorrect_pairs = $6::jsonb,
          missing_pairs = $7::jsonb,
          plan_accion = $8::jsonb,
          case_guesses = $9::jsonb,
          group_guesses = $10::jsonb,
          group_justifications = $11::jsonb,
          resuelto = TRUE,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $12
        RETURNING *
        `,
        [
          req.user.nombre || null,
          Number(score) || 0,
          Number(expectedTotal) || 0,
          Number(userTotal) || 0,
          JSON.stringify(correct),
          JSON.stringify(incorrect),
          JSON.stringify(missing),
          JSON.stringify(planAccion),
          JSON.stringify(caseGuesses),
          JSON.stringify(groupGuesses),
          JSON.stringify(groupJustifications),
          existingFeedback.id,
        ]
      );

      feedbackRow = updatedResult.rows[0];
      await client.query('DELETE FROM evaluacion_justificaciones WHERE evaluacion_id = $1', [existingFeedback.id]);
    } else {
      const insertFeedbackResult = await client.query(
        `
        INSERT INTO evaluaciones_investigador
          (usuario_id, usuario_nombre, puntaje, expected_total, user_total, correct_pairs, incorrect_pairs, missing_pairs, resuelto, plan_accion, case_guesses, group_guesses, group_justifications)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, TRUE, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb)
        RETURNING *
        `,
        [
          req.user.id,
          req.user.nombre || null,
          Number(score) || 0,
          Number(expectedTotal) || 0,
          Number(userTotal) || 0,
          JSON.stringify(correct),
          JSON.stringify(incorrect),
          JSON.stringify(missing),
          JSON.stringify(planAccion),
          JSON.stringify(caseGuesses),
          JSON.stringify(groupGuesses),
          JSON.stringify(groupJustifications),
        ]
      );

      feedbackRow = insertFeedbackResult.rows[0];
    }

    for (const item of cleanJustificaciones) {
      await client.query(
        `
        INSERT INTO evaluacion_justificaciones (evaluacion_id, pair_key, pair_label, reason)
        VALUES ($1, $2, $3, $4)
        `,
        [feedbackRow.id, item.pairKey, item.pairLabel, String(item.reason).trim()]
      );
    }

    await client.query('COMMIT');

    const justificacionesRows = await fetchJustificaciones(feedbackRow.id);

    return res.status(existingResult.rows.length > 0 ? 200 : 201).json({
      feedback: mapFeedbackResponse(feedbackRow, justificacionesRows),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creando feedback del investigador:', error);
    return res.status(500).json({ error: 'No fue posible guardar el feedback del investigador' });
  } finally {
    client.release();
  }
});

router.put('/me/justificaciones', authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureSchema();

    const feedbackResult = await client.query(
      'SELECT * FROM evaluaciones_investigador WHERE usuario_id = $1 LIMIT 1',
      [req.user.id]
    );

    if (feedbackResult.rows.length === 0) {
      return res.status(404).json({ error: 'No hay feedback registrado para este investigador' });
    }

    const feedback = feedbackResult.rows[0];
    const { justificaciones = [], planAccion = [] } = req.body || {};
    const cleanJustificaciones = justificaciones.filter((item) => String(item?.reason || '').trim().length > 0);

    await client.query('BEGIN');
    await client.query('DELETE FROM evaluacion_justificaciones WHERE evaluacion_id = $1', [feedback.id]);

    for (const item of cleanJustificaciones) {
      await client.query(
        `
        INSERT INTO evaluacion_justificaciones (evaluacion_id, pair_key, pair_label, reason)
        VALUES ($1, $2, $3, $4)
        `,
        [feedback.id, item.pairKey, item.pairLabel, String(item.reason).trim()]
      );
    }

    const updateFeedbackResult = await client.query(
      `
      UPDATE evaluaciones_investigador
      SET plan_accion = $1::jsonb, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
      `,
      [JSON.stringify(planAccion), feedback.id]
    );

    await client.query('COMMIT');

    const justificacionesRows = await fetchJustificaciones(feedback.id);

    return res.json({
      feedback: mapFeedbackResponse(updateFeedbackResult.rows[0], justificacionesRows),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error actualizando justificaciones:', error);
    return res.status(500).json({ error: 'No fue posible actualizar las justificaciones' });
  } finally {
    client.release();
  }
});

router.get('/justificaciones', authenticate, requireAdmin, async (_req, res) => {
  try {
    await ensureSchema();

    const result = await pool.query(`
      SELECT
        ei.id AS evaluacion_id,
        ei.usuario_id,
        COALESCE(u.nombre, ei.usuario_nombre) AS investigador_nombre,
        ei.puntaje,
        ei.expected_total,
        ei.user_total,
        ei.resuelto,
        ei.created_at AS evaluacion_fecha,
        ej.pair_key,
        ej.pair_label,
        ej.reason,
        ej.created_at AS justificacion_fecha
      FROM evaluaciones_investigador ei
      JOIN evaluacion_justificaciones ej ON ei.id = ej.evaluacion_id
      LEFT JOIN usuarios u ON u.id = ei.usuario_id
      WHERE LENGTH(TRIM(COALESCE(ej.reason, ''))) > 0
      ORDER BY ei.created_at DESC, ej.created_at DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error('Error listando justificaciones de feedback:', error);
    return res.status(500).json({ error: 'No fue posible listar justificaciones' });
  }
});

module.exports = router;
