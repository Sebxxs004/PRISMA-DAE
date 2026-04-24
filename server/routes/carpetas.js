const express = require('express');
const pool = require('../db');

const router = express.Router();

const ensureMetadataColumns = async () => {
  try {
    await pool.query(`
      ALTER TABLE carpetas
      ADD COLUMN IF NOT EXISTS tipo_delito VARCHAR(150),
      ADD COLUMN IF NOT EXISTS fecha_caso DATE,
      ADD COLUMN IF NOT EXISTS victima TEXT,
      ADD COLUMN IF NOT EXISTS victimario TEXT,
      ADD COLUMN IF NOT EXISTS zona_territorial VARCHAR(180),
      ADD COLUMN IF NOT EXISTS actores_involucrados TEXT,
      ADD COLUMN IF NOT EXISTS es_autor_intelectual BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS es_zona_operacion BOOLEAN DEFAULT FALSE
    `);
  } catch (error) {
    console.error('No fue posible asegurar columnas de metadatos en carpetas:', error);
  }
};

ensureMetadataColumns();

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
            c.tipo_delito, c.fecha_caso, c.victima, c.victimario, c.zona_territorial, c.actores_involucrados,
            c.es_autor_intelectual, c.es_zona_operacion,
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
    const {
      nombre,
      descripcion,
      imagen_url,
      usuario_id,
      modalidad,
      patrones,
      tipo_delito,
      fecha_caso,
      victima,
      victimario,
      zona_territorial,
      actores_involucrados,
      es_autor_intelectual,
      es_zona_operacion,
    } = req.body;

    if (!nombre || !usuario_id) {
      return res.status(400).json({ error: 'Nombre y usuario_id requeridos' });
    }

    const result = await pool.query(
      `INSERT INTO carpetas (
        nombre, descripcion, imagen_url, modalidad, patrones, created_by,
        tipo_delito, fecha_caso, victima, victimario, zona_territorial, actores_involucrados,
        es_autor_intelectual, es_zona_operacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, nombre, descripcion, imagen_url, modalidad, patrones,
                tipo_delito, fecha_caso, victima, victimario, zona_territorial, actores_involucrados,
                es_autor_intelectual, es_zona_operacion, created_at`,
      [
        nombre,
        descripcion || null,
        imagen_url || null,
        modalidad || null,
        patrones || null,
        usuario_id,
        tipo_delito || null,
        fecha_caso || null,
        victima || null,
        victimario || null,
        zona_territorial || null,
        actores_involucrados || null,
        Boolean(es_autor_intelectual),
        Boolean(es_zona_operacion),
      ]
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
    const {
      nombre,
      descripcion,
      imagen_url,
      modalidad,
      patrones,
      tipo_delito,
      fecha_caso,
      victima,
      victimario,
      zona_territorial,
      actores_involucrados,
      es_autor_intelectual,
      es_zona_operacion,
    } = req.body;

    const result = await pool.query(
      `UPDATE carpetas
       SET nombre = $1,
           descripcion = $2,
           imagen_url = $3,
           modalidad = $4,
           patrones = $5,
           tipo_delito = $6,
           fecha_caso = $7,
           victima = $8,
           victimario = $9,
           zona_territorial = $10,
           actores_involucrados = $11,
           es_autor_intelectual = $12,
           es_zona_operacion = $13,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $14
       RETURNING *`,
      [
        nombre,
        descripcion,
        imagen_url,
        modalidad,
        patrones,
        tipo_delito || null,
        fecha_caso || null,
        victima || null,
        victimario || null,
        zona_territorial || null,
        actores_involucrados || null,
        Boolean(es_autor_intelectual),
        Boolean(es_zona_operacion),
        id,
      ]
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
