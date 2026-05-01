-- Crear extensiones si es necesario
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Roles
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(50) UNIQUE NOT NULL,
  descripcion VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar roles predefinidos
INSERT INTO roles (nombre, descripcion) VALUES
  ('admin', 'Administrador del sistema - puede crear y editar casos'),
  ('fiscal', 'Fiscal - puede consultar casos y crear análisis');

-- Tabla de Usuarios
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol_id INTEGER NOT NULL REFERENCES roles(id),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Carpetas (Casos)
CREATE TABLE carpetas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  modalidad VARCHAR(100),
  patrones VARCHAR(500),
  tipo_delito VARCHAR(150),
  fecha_caso DATE,
  victima TEXT,
  victimario TEXT,
  zona_territorial VARCHAR(180),
  actores_involucrados TEXT,
  es_aislado BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Documentos
CREATE TABLE documentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carpeta_id UUID NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  archivo_url TEXT,
  tipo_archivo VARCHAR(50),
  tamaño_bytes INTEGER,
  created_by UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Conexiones entre Carpetas (para el grafo 3D)
CREATE TABLE conexiones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carpeta_origen_id UUID NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
  carpeta_destino_id UUID NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  razonamiento TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Grupos de Asociación
CREATE TABLE grupos_asociacion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(200) NOT NULL,  patron_criminal VARCHAR(255) DEFAULT '',  justificacion_general TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Casos pertenecientes a un grupo de asociación
CREATE TABLE grupos_asociacion_casos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grupo_id UUID NOT NULL REFERENCES grupos_asociacion(id) ON DELETE CASCADE,
  carpeta_id UUID NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (grupo_id, carpeta_id)
);

-- Relaciones directas entre pares dentro de un grupo
CREATE TABLE grupos_asociacion_relaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grupo_id UUID NOT NULL REFERENCES grupos_asociacion(id) ON DELETE CASCADE,
  carpeta_a_id UUID NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
  carpeta_b_id UUID NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) NOT NULL,
  justificacion TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (grupo_id, carpeta_a_id, carpeta_b_id)
);

-- Casos excluidos de un grupo con justificación individual
CREATE TABLE grupos_asociacion_exclusiones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grupo_id UUID NOT NULL REFERENCES grupos_asociacion(id) ON DELETE CASCADE,
  carpeta_id UUID NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
  justificacion_no_relacion TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (grupo_id, carpeta_id)
);

-- Tabla de feedback final de la prueba investigativa (una por fiscal)
CREATE TABLE evaluaciones_fiscal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  usuario_nombre VARCHAR(120),
  puntaje INTEGER NOT NULL,
  expected_total INTEGER NOT NULL,
  user_total INTEGER NOT NULL,
  correct_pairs JSONB NOT NULL DEFAULT '[]'::jsonb,
  incorrect_pairs JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_pairs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Justificaciones de desacuerdo por conexión (solo cuando hay texto)
CREATE TABLE evaluacion_justificaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluacion_id UUID NOT NULL REFERENCES evaluaciones_fiscal(id) ON DELETE CASCADE,
  pair_key TEXT NOT NULL,
  pair_label TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (evaluacion_id, pair_key)
);

-- Crear índices para mejores búsquedas
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol_id ON usuarios(rol_id);
CREATE INDEX idx_carpetas_created_by ON carpetas(created_by);
CREATE INDEX idx_documentos_carpeta_id ON documentos(carpeta_id);
CREATE INDEX idx_documentos_created_by ON documentos(created_by);

-- Insertar usuario admin por defecto (contraseña: admin123)
INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES
  ('Admin PRISMA', 'admin@prisma.dae', '$2a$10$s6yQpoOpta7funCAvjN9Du0vmfL1gPTKiIdbioiqsxZ7j.mWTLiyi', 1);

-- Insertar usuario fiscal de prueba (contraseña: fiscal123)
INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES
  ('Fiscal PRISMA', 'fiscal@prisma.dae', '$2a$10$FKHCQXc7XFTROoLbl0aafuevadc.P1WuDQKOnmT8PZWszPqJed9l.', 2);

-- Casos de prueba para mostrar el juego
INSERT INTO carpetas (nombre, descripcion, imagen_url, modalidad, patrones, es_aislado, created_by)
VALUES
  (
    'Caso A - Taller de motores',
    'Expediente con facturas alteradas, piezas duplicadas y proveedores repetidos.',
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    'fraude interno',
    'facturas alteradas, piezas duplicadas, mismos proveedores',
    FALSE,
    (SELECT id FROM usuarios WHERE email = 'admin@prisma.dae' LIMIT 1)
  ),
  (
    'Caso B - Almacen nocturno',
    'Reingresos de inventario fuera de horario con accesos repetidos.',
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    'fraude interno',
    'turnos nocturnos, acceso repetido, inventario faltante',
    FALSE,
    (SELECT id FROM usuarios WHERE email = 'admin@prisma.dae' LIMIT 1)
  ),
  (
    'Caso C - Oficina de cuentas',
    'Pagos desviados a cuentas puente con beneficiarios coincidentes.',
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    'fraude financiero',
    'cuentas puente, transferencias similares, beneficiarios coincidentes',
    FALSE,
    (SELECT id FROM usuarios WHERE email = 'admin@prisma.dae' LIMIT 1)
  );

INSERT INTO documentos (carpeta_id, nombre, descripcion, archivo_url, created_by)
VALUES
  (
    (SELECT id FROM carpetas WHERE nombre = 'Caso A - Taller de motores' LIMIT 1),
    'Informe inicial del taller',
    'Resumen del peritaje y lista de proveedores revisados.',
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    (SELECT id FROM usuarios WHERE email = 'admin@prisma.dae' LIMIT 1)
  ),
  (
    (SELECT id FROM carpetas WHERE nombre = 'Caso B - Almacen nocturno' LIMIT 1),
    'Parte de inventario nocturno',
    'Detalle de accesos y movimientos irregulares.',
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    (SELECT id FROM usuarios WHERE email = 'admin@prisma.dae' LIMIT 1)
  ),
  (
    (SELECT id FROM carpetas WHERE nombre = 'Caso C - Oficina de cuentas' LIMIT 1),
    'Registro de transferencias',
    'Extractos y cuentas puente asociadas a las transferencias.',
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    (SELECT id FROM usuarios WHERE email = 'admin@prisma.dae' LIMIT 1)
  );

INSERT INTO grupos_asociacion (nombre, justificacion_general, created_by)
VALUES
  (
    'Grupo de desvio operativo',
    'Los tres casos comparten proveedores, movimientos nocturnos y un mismo patron de desvio.',
    (SELECT id FROM usuarios WHERE email = 'admin@prisma.dae' LIMIT 1)
  );

INSERT INTO grupos_asociacion_casos (grupo_id, carpeta_id)
VALUES
  (
    (SELECT id FROM grupos_asociacion WHERE nombre = 'Grupo de desvio operativo' LIMIT 1),
    (SELECT id FROM carpetas WHERE nombre = 'Caso A - Taller de motores' LIMIT 1)
  ),
  (
    (SELECT id FROM grupos_asociacion WHERE nombre = 'Grupo de desvio operativo' LIMIT 1),
    (SELECT id FROM carpetas WHERE nombre = 'Caso B - Almacen nocturno' LIMIT 1)
  ),
  (
    (SELECT id FROM grupos_asociacion WHERE nombre = 'Grupo de desvio operativo' LIMIT 1),
    (SELECT id FROM carpetas WHERE nombre = 'Caso C - Oficina de cuentas' LIMIT 1)
  );

INSERT INTO grupos_asociacion_relaciones (grupo_id, carpeta_a_id, carpeta_b_id, relation_type, justificacion, created_by)
VALUES
  (
    (SELECT id FROM grupos_asociacion WHERE nombre = 'Grupo de desvio operativo' LIMIT 1),
    (SELECT id FROM carpetas WHERE nombre = 'Caso A - Taller de motores' LIMIT 1),
    (SELECT id FROM carpetas WHERE nombre = 'Caso B - Almacen nocturno' LIMIT 1),
    'patrones',
    'Ambos casos muestran movimientos fuera de horario y proveedores recurrentes.',
    (SELECT id FROM usuarios WHERE email = 'admin@prisma.dae' LIMIT 1)
  ),
  (
    (SELECT id FROM grupos_asociacion WHERE nombre = 'Grupo de desvio operativo' LIMIT 1),
    (SELECT id FROM carpetas WHERE nombre = 'Caso A - Taller de motores' LIMIT 1),
    (SELECT id FROM carpetas WHERE nombre = 'Caso C - Oficina de cuentas' LIMIT 1),
    'patrones',
    'Las transferencias y las facturas alteradas apuntan al mismo circuito de desvio.',
    (SELECT id FROM usuarios WHERE email = 'admin@prisma.dae' LIMIT 1)
  ),
  (
    (SELECT id FROM grupos_asociacion WHERE nombre = 'Grupo de desvio operativo' LIMIT 1),
    (SELECT id FROM carpetas WHERE nombre = 'Caso B - Almacen nocturno' LIMIT 1),
    (SELECT id FROM carpetas WHERE nombre = 'Caso C - Oficina de cuentas' LIMIT 1),
    'patrones',
    'Las entradas de inventario y los pagos puente comparten el mismo horario y beneficiarios.',
    (SELECT id FROM usuarios WHERE email = 'admin@prisma.dae' LIMIT 1)
  );
