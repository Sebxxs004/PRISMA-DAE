const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
});

// Conexión a la base de datos (pronto)
// const db = require('./db');

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/carpetas', require('./routes/carpetas'));
app.use('/api/documentos', require('./routes/documentos'));
app.use('/api/conexiones', require('./routes/conexiones'));
app.use('/api/grupos-asociacion', require('./routes/gruposAsociacion'));
app.use('/api/investigacion-feedback', require('./routes/investigacionFeedback'));
app.use('/api/admin', require('./routes/adminInvestigators'));
app.use('/api/configuracion', require('./routes/configuracion'));

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Server running', timestamp: new Date().toISOString() });
});

app.get('*', (req, res, next) => {
  if (!req.method || req.method !== 'GET' || req.path.startsWith('/api')) {
    return next();
  }

  return res.sendFile(path.join(publicDir, 'index.html'), (error) => {
    if (error) {
      next(error);
    }
  });
});

app.listen(PORT, () => {
  console.log(`PRISMA DAE Server running on port ${PORT}`);
});
