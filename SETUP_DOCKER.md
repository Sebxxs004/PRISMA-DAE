# 🚀 PRISMA DAE - Guía de Ejecución con Docker

## Requisitos
- Docker Desktop instalado y en ejecución
- Node.js v18+ (opcional, solo si desarrollas sin contenedor)

## 🐳 Ejecutar con Docker

### 1. Levantar la Base de Datos (PostgreSQL)

```bash
# En la raíz del proyecto
docker compose up -d
```

Esto iniciará:
- **PostgreSQL** en el puerto 5433
- Base de datos: `prisma_dae`
- Usuario: `prisma_admin`
- Contraseña: `prisma_secure_2026`

Verificar que el contenedor está corriendo:
```bash
docker compose ps
```

### 2. Instalar Dependencias del Backend

```bash
cd server
npm install
```

### 3. Iniciar el Servidor Backend

```bash
npm start
# o para desarrollo con nodemon:
npm run dev
```

El API estará disponible en: `http://localhost:5000`

### 4. En otra terminal, instalar dependencias del Frontend

```bash
# Vuelve a la raíz
cd ..
npm install
```

### 5. Iniciar el Frontend (Vite)

```bash
npm run dev
```

La aplicación estará disponible en: `http://localhost:5173`

---

## 🔐 Credenciales de Demo

### Administrador
- **Email:** `admin@prisma.dae`
- **Contraseña:** `admin123`

### Investigador
- **Email:** `investigador@prisma.dae`
- **Contraseña:** `investigador123`

---

## 📊 Estructura de BD

### Tablas Principales
- **usuarios**: Gestión de usuarios y autenticación
- **roles**: Admin e Investigador (predefinidos)
- **carpetas**: Casos de investigación
- **documentos**: Archivos dentro de cada caso
- **conexiones**: Nexos entre casos (para grafo 3D)

---

## 🛑 Detener Servicios

```bash
# Detener contenedor de BD
docker compose down

# Detener solo BD pero mantener volúmenes
docker compose down -v
```

---

## 🔧 Variables de Entorno (.env del servidor)

```
DB_USER=prisma_admin
DB_PASSWORD=prisma_secure_2026
DB_HOST=localhost
DB_NAME=prisma_dae
DB_PORT=5433
JWT_SECRET=prisma_secret_key_2026
PORT=5000
```

---

## 📝 Endpoints API Disponibles

### Autenticación
- `POST /api/auth/login` - Inicia sesión
- `POST /api/auth/register` - Registra nuevo usuario

### Carpetas (Casos)
- `GET /api/carpetas` - Listar casos
- `POST /api/carpetas` - Crear caso
- `GET /api/carpetas/:id` - Ver caso específico
- `PUT /api/carpetas/:id` - Actualizar caso
- `DELETE /api/carpetas/:id` - Eliminar caso

### Documentos
- `GET /api/documentos/carpeta/:carpeta_id` - Documentos de un caso
- `POST /api/documentos` - Crear documento
- `PUT /api/documentos/:id` - Actualizar documento
- `DELETE /api/documentos/:id` - Eliminar documento

---

## 🐛 Troubleshooting

### Error: "Cannot connect to database"
  - Verificar que el contenedor PostgreSQL está corriendo: `docker compose ps`
  - Verificar puerto 5433 no esté ocupado

### Error al ejecutar varios comandos en PowerShell
  - En PowerShell usa `;` para encadenar comandos, por ejemplo: `docker compose up -d; Set-Location server; npm install; npm start`

### Error: "Port 5173 already in use"
  - Cambiar puerto: `npm run dev -- --port 3000`

### Error: "API connection refused"
  - Verificar que el servidor backend está en ejecución (`npm start`)
  - Verificar URL del API en el frontend: `http://localhost:5000/api`

---

**Última actualización:** 15 de abril de 2026
