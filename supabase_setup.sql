-- ============================================================
-- SQL COMPLETO - ALMACÉN DON DIEGO (SUPABASE)
-- BORRA TODO Y LO RECONSTRUYE DESDE CERO
-- ============================================================

-- ============================================================
-- BORRAR TODO (orden correcto por foreign keys)
-- ============================================================
DROP TABLE IF EXISTS descuentos;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS configuracion;
DROP TABLE IF EXISTS admins;

-- ============================================================
-- 1. ADMINISTRADORES
-- ============================================================
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    nombre TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO admins (email, nombre) VALUES
    ('almacendondiego24@gmail.com', 'Admin Almacén Don Diego');

-- ============================================================
-- 1b. CONFIGURACIÓN GENERAL
-- ============================================================
CREATE TABLE configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO configuracion (clave, valor) VALUES
    ('footer_year', '2025');

-- ============================================================
-- 2. CATEGORÍAS
-- ============================================================
CREATE TABLE categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    icono TEXT DEFAULT '📦',
    slug TEXT NOT NULL UNIQUE,
    orden INTEGER DEFAULT 0,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. PRODUCTOS
-- ============================================================
CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
    precio INTEGER NOT NULL,
    stock INTEGER DEFAULT 0,
    descripcion TEXT,
    descuento INTEGER DEFAULT 0,
    disponible BOOLEAN DEFAULT true,
    destacado BOOLEAN DEFAULT false,
    imagen_url TEXT,
    variantes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. PEDIDOS
-- ============================================================
CREATE TABLE pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_nombre TEXT,
    cliente_telefono TEXT,
    productos JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal INTEGER NOT NULL,
    envio INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL,
    tipo_entrega TEXT NOT NULL DEFAULT 'recoger',
    direccion TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. DESCUENTOS (promociones por tiempo limitado)
-- ============================================================
CREATE TABLE descuentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('producto', 'categoria')),
    referencia_id UUID NOT NULL,
    descuento INTEGER NOT NULL CHECK (descuento >= 1 AND descuento <= 100),
    fecha_fin TIMESTAMPTZ,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_disponible ON productos(disponible);
CREATE INDEX idx_productos_destacado ON productos(destacado);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_created_at ON pedidos(created_at DESC);
CREATE INDEX idx_descuentos_fecha ON descuentos(activa, fecha_fin);

-- ============================================================
-- SEGURIDAD (RLS) - TODAS las tablas
-- ============================================================
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE descuentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública admins" ON admins
    FOR SELECT USING (true);

CREATE POLICY "Acceso público categorias" ON categorias
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acceso público productos" ON productos
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acceso público pedidos" ON pedidos
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acceso público descuentos" ON descuentos
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acceso público configuracion" ON configuracion
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- STORAGE: Bucket para imágenes
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('productos', 'productos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Acceso público imágenes" ON storage.objects;
CREATE POLICY "Acceso público imágenes" ON storage.objects
    FOR ALL USING (bucket_id = 'productos') WITH CHECK (bucket_id = 'productos');
