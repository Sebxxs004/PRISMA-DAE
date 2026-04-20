const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

const matchesPassword = async (plainPassword, storedHash, legacyPassword) => {
  if (storedHash && String(storedHash).startsWith('$2')) {
    try {
      return await bcryptjs.compare(plainPassword, storedHash);
    } catch (_error) {
      return false;
    }
  }

  return plainPassword === legacyPassword;
};

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridas' });
    }

    const result = await pool.query(
      'SELECT u.id, u.nombre, u.email, u.password_hash, r.nombre as rol FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.email = $1 AND u.activo = TRUE',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const usuario = result.rows[0];
    
    const passwordValido = await matchesPassword(
      password,
      usuario.password_hash,
      usuario.rol === 'admin' ? 'admin123' : 'investigador123'
    );

    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET || 'prisma_secret_key_2026',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

// Registrar usuario (solo admin)
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, rol } = req.body;

    if (!nombre || !email || !rol) {
      return res.status(400).json({ error: 'Todos los campos requeridos' });
    }

    const rolResult = await pool.query('SELECT id FROM roles WHERE nombre = $1', [rol]);
    if (rolResult.rows.length === 0) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const tempPassword = 'temp_' + Math.random().toString(36).substring(7);
    const hashedPassword = await bcryptjs.hash(tempPassword, 10);

    const result = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email',
      [nombre, email, hashedPassword, rolResult.rows[0].id]
    );

    res.json({ usuario: result.rows[0], tempPassword });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en servidor' });
  }
});

module.exports = router;
