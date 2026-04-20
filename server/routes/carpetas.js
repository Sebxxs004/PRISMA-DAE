const express = require('express');
const pool = require('../db');

const router = express.Router();

// Middleware para verificar token (simplificado)
const verificarToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  // Aquí iría validación real del JWT
  next();
};

// Obtener todas las carpetas
router.get('/', verificarToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.nombre, c.descripcion, c.imagen_url, c.modalidad, c.patrones, c.es_aislado, c.created_at,
             u.nombre as created_by_nombre,
             COUNT(d.id) as cantidad_documentos
      FROM carpetas c
      LEFT JOIN usuarios u ON c.created_by = u.id
      LEFT JOIN documentos d ON c.id = d.carpeta_id
      GROUP BY c.id, u.nombre
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

// Crear carpeta
router.post('/', verificarToken, async (req, res) => {
  try {
    const { nombre, descripcion, imagen_url, usuario_id, modalidad, patrones } = req.body;

    if (!nombre || !usuario_id) {
      return res.status(400).json({ error: 'Nombre y usuario_id requeridos' });
    }

    const result = await pool.query(
      'INSERT INTO carpetas (nombre, descripcion, imagen_url, modalidad, patrones, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, descripcion, imagen_url, modalidad, patrones, created_at',
      [nombre, descripcion || null, imagen_url || null, modalidad || null, patrones || null, usuario_id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

// Obtener carpeta por ID
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM carpetas WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carpeta no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

// Actualizar carpeta
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, imagen_url, modalidad, patrones } = req.body;

    const result = await pool.query(
      'UPDATE carpetas SET nombre = $1, descripcion = $2, imagen_url = $3, modalidad = $4, patrones = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [nombre, descripcion, imagen_url, modalidad, patrones, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carpeta no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

// Eliminar carpeta
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM carpetas WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Carpeta no encontrada' });
    }

    res.json({ mensaje: 'Carpeta eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

module.exports = router;
