const express = require('express');
const pool = require('../db');

const router = express.Router();

// Middleware para verificar token (simplificado)
const verificarToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  next();
};

// Obtener documentos de una carpeta
router.get('/carpeta/:carpeta_id', verificarToken, async (req, res) => {
  try {
    const { carpeta_id } = req.params;
    const result = await pool.query(
      'SELECT * FROM documentos WHERE carpeta_id = $1 ORDER BY created_at DESC',
      [carpeta_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

// Crear documento
router.post('/', verificarToken, async (req, res) => {
  try {
    const { carpeta_id, nombre, descripcion, archivo_url, usuario_id } = req.body;

    if (!carpeta_id || !nombre || !usuario_id) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    const result = await pool.query(
      'INSERT INTO documentos (carpeta_id, nombre, descripcion, archivo_url, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [carpeta_id, nombre, descripcion || null, archivo_url || null, usuario_id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

// Actualizar documento
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, archivo_url } = req.body;

    const result = await pool.query(
      'UPDATE documentos SET nombre = $1, descripcion = $2, archivo_url = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [nombre, descripcion, archivo_url, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

// Eliminar documento
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM documentos WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    res.json({ mensaje: 'Documento eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

module.exports = router;
