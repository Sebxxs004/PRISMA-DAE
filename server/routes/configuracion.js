const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'prisma_secret_key_2026';

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalido' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administradores' });
  }
  return next();
};

const ensureConfigTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS configuracion_sistema (
      id SERIAL PRIMARY KEY,
      tiempo_limite_minutos INTEGER NOT NULL DEFAULT 10,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  const result = await pool.query('SELECT count(*) FROM configuracion_sistema');
  if (parseInt(result.rows[0].count) === 0) {
    await pool.query('INSERT INTO configuracion_sistema (tiempo_limite_minutos) VALUES (10)');
  }
};

router.get('/', authenticate, async (req, res) => {
  try {
    await ensureConfigTable();
    const result = await pool.query('SELECT tiempo_limite_minutos FROM configuracion_sistema LIMIT 1');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Error obteniendo configuracion' });
  }
});

router.put('/', authenticate, requireAdmin, async (req, res) => {
  try {
    await ensureConfigTable();
    const { tiempo_limite_minutos } = req.body;
    
    if (tiempo_limite_minutos === undefined || tiempo_limite_minutos < 60) {
      return res.status(400).json({ error: 'Tiempo límite inválido, el mínimo es 60 minutos' });
    }

    const result = await pool.query(
      'UPDATE configuracion_sistema SET tiempo_limite_minutos = $1, updated_at = CURRENT_TIMESTAMP RETURNING *',
      [tiempo_limite_minutos]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'Error actualizando configuracion' });
  }
});

module.exports = router;
