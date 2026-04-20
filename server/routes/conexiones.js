const express = require('express');
const db = require('../db');

const router = express.Router();

// Middleware simple consistente con el resto de rutas
const verificarToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  next();
};

router.get('/', verificarToken, async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT
        c.id,
        c.carpeta_origen_id,
        c.carpeta_destino_id,
        c.tipo,
        c.razonamiento,
        c.created_at,
        co.nombre AS caso_origen,
        cd.nombre AS caso_destino,
        co.modalidad AS modalidad_origen,
        cd.modalidad AS modalidad_destino,
        co.patrones AS patrones_origen,
        cd.patrones AS patrones_destino
      FROM conexiones c
      JOIN carpetas co ON c.carpeta_origen_id = co.id
      JOIN carpetas cd ON c.carpeta_destino_id = cd.id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo conexiones:', error);
    res.status(500).json({ error: 'Error obteniendo conexiones' });
  }
});

router.get('/carpeta/:carpeta_id', verificarToken, async (req, res) => {
  try {
    const { carpeta_id } = req.params;
    const result = await db.query(
      `
      SELECT
        c.id,
        c.carpeta_origen_id,
        c.carpeta_destino_id,
        c.tipo,
        c.razonamiento,
        c.created_at,
        co.nombre AS caso_origen,
        cd.nombre AS caso_destino,
        co.modalidad AS modalidad_origen,
        cd.modalidad AS modalidad_destino,
        co.patrones AS patrones_origen,
        cd.patrones AS patrones_destino
      FROM conexiones c
      JOIN carpetas co ON c.carpeta_origen_id = co.id
      JOIN carpetas cd ON c.carpeta_destino_id = cd.id
      WHERE c.carpeta_origen_id = $1 OR c.carpeta_destino_id = $1
      ORDER BY c.created_at DESC
      `,
      [carpeta_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo conexiones del caso:', error);
    res.status(500).json({ error: 'Error obteniendo conexiones' });
  }
});

router.post('/', verificarToken, async (req, res) => {
  try {
    const {
      carpeta_origen_id,
      carpeta_destino_id,
      tipo,
      razonamiento,
      usuario_id,
    } = req.body;

    if (!carpeta_origen_id || !carpeta_destino_id || !tipo || !usuario_id) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        valido: false,
        razon: 'Debes indicar caso origen, caso destino, tipo y usuario_id.',
      });
    }

    if (carpeta_origen_id === carpeta_destino_id) {
      return res.status(400).json({
        error: 'No puede conectar un caso consigo mismo',
        valido: false,
        razon: 'Los casos de origen y destino deben ser diferentes.',
      });
    }

    const duplicate = await db.query(
      `
      SELECT id
      FROM conexiones
      WHERE
        (carpeta_origen_id = $1 AND carpeta_destino_id = $2)
        OR
        (carpeta_origen_id = $2 AND carpeta_destino_id = $1)
      `,
      [carpeta_origen_id, carpeta_destino_id]
    );

    if (duplicate.rows.length > 0) {
      return res.status(400).json({
        error: 'Conexión duplicada',
        valido: false,
        razon: 'Estos dos casos ya están conectados.',
      });
    }

    const casosResult = await db.query(
      'SELECT * FROM carpetas WHERE id = $1 OR id = $2',
      [carpeta_origen_id, carpeta_destino_id]
    );

    if (casosResult.rows.length < 2) {
      return res.status(404).json({
        error: 'Uno o ambos casos no existen',
        valido: false,
        razon: 'Verifica que ambos casos existan.',
      });
    }

    let esValido = false;
    let motivo = '';
    const justificacion = (razonamiento || '').trim();

    if (tipo !== 'modalidad' && tipo !== 'patrones') {
      return res.status(400).json({
        error: 'Tipo inválido',
        valido: false,
        razon: 'Debes elegir si la conexión es por Modalidad o por Patrones.',
      });
    }

    if (!justificacion) {
      return res.status(400).json({
        error: 'Justificación requerida',
        valido: false,
        razon: `Debes justificar por qué conectas estos casos por ${tipo}.`,
      });
    }

    if (justificacion.length < 15) {
      return res.status(400).json({
        error: 'Justificación insuficiente',
        valido: false,
        razon: 'La justificación es muy corta. Explica mejor la conexión (mínimo 15 caracteres).',
      });
    }

    esValido = true;
    motivo = `Conexión válida por ${tipo}. Justificación registrada correctamente.`;

    if (!esValido) {
      return res.status(400).json({
        error: motivo,
        valido: false,
        razon: motivo,
      });
    }

    const result = await db.query(
      `
      INSERT INTO conexiones (carpeta_origen_id, carpeta_destino_id, tipo, razonamiento, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        carpeta_origen_id,
        carpeta_destino_id,
        tipo,
        justificacion,
        usuario_id,
      ]
    );

    res.status(201).json({
      ...result.rows[0],
      valido: true,
      razon: motivo,
    });
  } catch (error) {
    console.error('Error creando conexión:', error);
    res.status(500).json({ error: 'Error creando conexión' });
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM conexiones WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conexión no encontrada' });
    }

    res.json({ mensaje: 'Conexión eliminada', conexion: result.rows[0] });
  } catch (error) {
    console.error('Error eliminando conexión:', error);
    res.status(500).json({ error: 'Error eliminando conexión' });
  }
});

module.exports = router;
