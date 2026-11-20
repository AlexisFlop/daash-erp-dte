-- =====================================================================
-- DAASH ERP & DTE · Esquema de base de datos (PostgreSQL 16) · Flyway V1
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Dominios con validación fiscal salvadoreña ----------
CREATE DOMAIN dui_sv AS varchar(10) CHECK (VALUE ~ '^\d{8}-\d$');
CREATE DOMAIN nit_sv AS varchar(17) CHECK (VALUE ~ '^\d{4}-\d{6}-\d{3}-\d$' OR VALUE ~ '^\d{8}-\d$');
CREATE DOMAIN nrc_sv AS varchar(8)  CHECK (VALUE ~ '^\d{1,6}-\d$');
CREATE DOMAIN dinero AS numeric(12,2) CHECK (VALUE >= 0);
CREATE DOMAIN correo AS varchar(120) CHECK (VALUE ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$');

CREATE FUNCTION dui_valido(d text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT d ~ '^\d{8}-\d$' AND
    (10 - (SELECT sum(substr(d, i, 1)::int * (10 - i)) FROM generate_series(1, 8) i) % 10) % 10 = substr(d, 10, 1)::int
$$;

-- ---------- Seguridad ----------
CREATE TABLE sucursal (
  id smallserial PRIMARY KEY,
  nombre varchar(80) NOT NULL UNIQUE,
  cod_establecimiento char(4) NOT NULL UNIQUE,
  cod_punto_venta char(4) NOT NULL
);

CREATE TABLE rol (
  id varchar(40) PRIMARY KEY,
  nombre varchar(60) NOT NULL UNIQUE,
  descripcion text,
  sistema boolean NOT NULL DEFAULT false,
  autoriza_descuentos boolean NOT NULL DEFAULT false
);

CREATE TABLE permiso (
  rol_id varchar(40) REFERENCES rol(id) ON DELETE CASCADE,
  modulo varchar(30) NOT NULL,
  crear boolean NOT NULL DEFAULT false,
  leer boolean NOT NULL DEFAULT false,
  actualizar boolean NOT NULL DEFAULT false,
  borrar boolean NOT NULL DEFAULT false,
  PRIMARY KEY (rol_id, modulo),
  CHECK (leer OR NOT (crear OR actualizar OR borrar))
);

CREATE TABLE usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre varchar(120) NOT NULL,
  correo correo NOT NULL,
  password_hash varchar(72) NOT NULL,
  dui dui_sv NOT NULL CHECK (dui_valido(dui)),
  rol_id varchar(40) NOT NULL REFERENCES rol(id),
  sucursal_id smallint NOT NULL REFERENCES sucursal(id),
  activo boolean NOT NULL DEFAULT true,
  intentos_fallidos smallint NOT NULL DEFAULT 0 CHECK (intentos_fallidos BETWEEN 0 AND 5),
  bloqueado_hasta timestamptz,
  ultimo_acceso timestamptz,
  creado timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_usuario_correo ON usuario (lower(correo));

CREATE TABLE reset_token (
  token varchar(64) PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  expira timestamptz NOT NULL,
  usado boolean NOT NULL DEFAULT false
);

-- ---------- Terceros ----------
CREATE TABLE cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo varchar(13) NOT NULL CHECK (tipo IN ('CONSUMIDOR','CONTRIBUYENTE')),
  nombre varchar(200) NOT NULL,
  nombre_comercial varchar(200),
  tipo_documento char(2) NOT NULL CHECK (tipo_documento IN ('13','36')),
  num_documento varchar(17) NOT NULL,
  nrc nrc_sv,
  cod_actividad varchar(6),
  desc_actividad varchar(150),
  correo correo,
  telefono varchar(15),
  departamento char(2) NOT NULL,
  municipio char(2) NOT NULL,
  direccion varchar(250),
  activo boolean NOT NULL DEFAULT true,
  creado timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_documento, num_documento),
  CHECK (tipo_documento <> '13' OR dui_valido(num_documento)),
  CHECK (tipo_documento <> '36' OR num_documento ~ '^\d{4}-\d{6}-\d{3}-\d$'),
  CHECK (tipo <> 'CONTRIBUYENTE' OR (nrc IS NOT NULL AND cod_actividad IS NOT NULL AND correo IS NOT NULL))
);

CREATE TABLE proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social varchar(200) NOT NULL,
  nit nit_sv NOT NULL UNIQUE,
  nrc nrc_sv NOT NULL UNIQUE,
  contacto varchar(120) NOT NULL,
  telefono varchar(15) NOT NULL,
  correo correo,
  activo boolean NOT NULL DEFAULT true
);

-- ---------- Inventario ----------
CREATE TABLE categoria (id smallserial PRIMARY KEY, nombre varchar(60) NOT NULL UNIQUE);

CREATE TABLE producto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku varchar(30) NOT NULL UNIQUE,
  codigo_barras varchar(20) UNIQUE,
  nombre varchar(150) NOT NULL,
  descripcion text,
  categoria_id smallint NOT NULL REFERENCES categoria(id),
  precio_venta dinero NOT NULL CHECK (precio_venta > 0),
  costo dinero NOT NULL,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo integer NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE kardex (
  id bigserial PRIMARY KEY,
  fecha timestamptz NOT NULL DEFAULT now(),
  producto_id uuid NOT NULL REFERENCES producto(id),
  tipo varchar(12) NOT NULL CHECK (tipo IN ('INICIAL','ENTRADA','SALIDA','AJUSTE_POS','AJUSTE_NEG','DEVOLUCION')),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  saldo integer NOT NULL CHECK (saldo >= 0),
  costo_unitario dinero NOT NULL,
  referencia varchar(80) NOT NULL,
  justificacion text,
  usuario_id uuid NOT NULL REFERENCES usuario(id),
  CHECK (tipo NOT IN ('AJUSTE_POS','AJUSTE_NEG') OR length(trim(COALESCE(justificacion, ''))) >= 10)
);

-- ---------- Caja y ventas ----------
CREATE TABLE turno_caja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuario(id),
  caja varchar(20) NOT NULL,
  apertura timestamptz NOT NULL DEFAULT now(),
  fondo_inicial dinero NOT NULL,
  cierre timestamptz,
  efectivo_contado dinero,
  estado varchar(7) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO','CERRADO')),
  total_ventas dinero,
  transacciones integer,
  total_efectivo dinero,
  total_tarjeta dinero,
  total_transferencia dinero,
  esperado_efectivo dinero,
  diferencia numeric(12,2),
  CHECK ((estado = 'CERRADO') = (cierre IS NOT NULL))
);
CREATE UNIQUE INDEX ux_turno_abierto ON turno_caja (usuario_id) WHERE estado = 'ABIERTO';

CREATE TABLE venta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha timestamptz NOT NULL DEFAULT now(),
  turno_id uuid NOT NULL REFERENCES turno_caja(id),
  usuario_id uuid NOT NULL REFERENCES usuario(id),
  cliente_id uuid REFERENCES cliente(id),
  tipo_dte char(2) NOT NULL CHECK (tipo_dte IN ('01','03')),
  metodo_pago varchar(13) NOT NULL CHECK (metodo_pago IN ('EFECTIVO','TARJETA','TRANSFERENCIA')),
  descuento_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (descuento_pct BETWEEN 0 AND 100),
  autorizado_por uuid REFERENCES usuario(id),
  subtotal dinero NOT NULL,
  descuento dinero NOT NULL DEFAULT 0,
  iva dinero NOT NULL,
  total dinero NOT NULL,
  recibido dinero,
  cambio numeric(12,2),
  dte_id uuid,
  CHECK (tipo_dte <> '03' OR cliente_id IS NOT NULL)
);

CREATE TABLE venta_detalle (
  venta_id uuid REFERENCES venta(id) ON DELETE CASCADE,
  linea smallint,
  producto_id uuid NOT NULL REFERENCES producto(id),
  sku varchar(30) NOT NULL,
  nombre varchar(150) NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario dinero NOT NULL,
  PRIMARY KEY (venta_id, linea)
);

-- ---------- Compras ----------
CREATE TABLE compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha timestamptz NOT NULL,
  proveedor_id uuid NOT NULL REFERENCES proveedor(id),
  numero_comprobante varchar(40) NOT NULL,
  subtotal dinero NOT NULL, iva dinero NOT NULL, total dinero NOT NULL,
  usuario_id uuid NOT NULL REFERENCES usuario(id),
  UNIQUE (proveedor_id, numero_comprobante)
);
CREATE TABLE compra_detalle (
  compra_id uuid REFERENCES compra(id) ON DELETE CASCADE,
  linea smallint,
  producto_id uuid NOT NULL REFERENCES producto(id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  costo_unitario dinero NOT NULL,
  PRIMARY KEY (compra_id, linea)
);

-- ---------- Facturación electrónica ----------
CREATE TABLE correlativo (
  tipo_dte char(2) PRIMARY KEY,
  ultimo bigint NOT NULL DEFAULT 0 CHECK (ultimo >= 0)
);

CREATE TABLE evento_contingencia (
  id uuid PRIMARY KEY,
  f_inicio timestamptz NOT NULL,
  f_fin timestamptz,
  tipo_contingencia smallint NOT NULL CHECK (tipo_contingencia BETWEEN 1 AND 5),
  motivo varchar(500),
  estado varchar(15) NOT NULL CHECK (estado IN ('ACTIVO','PENDIENTE_ENVIO','TRANSMITIDO')),
  sello_recepcion char(40),
  documento_json jsonb,
  usuario_id uuid REFERENCES usuario(id),
  CHECK (tipo_contingencia <> 5 OR motivo IS NOT NULL),
  CHECK (f_fin IS NULL OR f_fin >= f_inicio)
);
CREATE UNIQUE INDEX ux_evento_activo ON evento_contingencia ((estado)) WHERE estado = 'ACTIVO';

-- Particionada por año de emisión: retención de 10 años (RNF-05)
CREATE TABLE dte_encabezado (
  codigo_generacion uuid NOT NULL,
  fecha_emision date NOT NULL,
  hora_emision time NOT NULL,
  creado timestamptz NOT NULL DEFAULT now(),
  tipo_dte char(2) NOT NULL CHECK (tipo_dte IN ('01','03','05','06','11','14')),
  numero_control varchar(31) NOT NULL CHECK (numero_control ~ '^DTE-\d{2}-[A-Z0-9]{8}-\d{15}$'),
  venta_id uuid,
  cliente_id uuid,
  usuario_id uuid NOT NULL,
  receptor_nombre varchar(200) NOT NULL,
  total_gravada dinero NOT NULL,
  total_iva dinero NOT NULL,
  total_pagar dinero NOT NULL,
  estado varchar(12) NOT NULL CHECK (estado IN ('PROCESADO','CONTINGENCIA','RECHAZADO','INVALIDADO')),
  tipo_modelo smallint NOT NULL CHECK (tipo_modelo IN (1,2)),
  sello_recepcion char(40),
  fh_procesamiento varchar(19),
  ambiente char(2) NOT NULL DEFAULT '00',
  documento_json jsonb NOT NULL,
  firma_jws text NOT NULL,
  respuesta_mh jsonb,
  intentos integer NOT NULL DEFAULT 0,
  ultimo_intento timestamptz,
  relacionado_id uuid,
  evento_contingencia_id uuid,
  invalidacion jsonb,
  correo_enviado varchar(120),
  PRIMARY KEY (codigo_generacion, fecha_emision),
  UNIQUE (numero_control, fecha_emision),
  CHECK (estado <> 'PROCESADO' OR sello_recepcion IS NOT NULL)
) PARTITION BY RANGE (fecha_emision);

DO $$ BEGIN
  FOR y IN 2024..2035 LOOP
    EXECUTE format('CREATE TABLE dte_%s PARTITION OF dte_encabezado FOR VALUES FROM (%L) TO (%L)', y, y || '-01-01', (y + 1) || '-01-01');
  END LOOP;
END $$;

CREATE TABLE dte_bitacora (
  id bigserial PRIMARY KEY,
  codigo_generacion uuid NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(),
  evento varchar(30) NOT NULL,
  codigo_msg varchar(5),
  descripcion text,
  respuesta_mh jsonb
);

-- ---------- Configuración, bitácora de la aplicación y correo simulado ----------
CREATE TABLE configuracion (
  id smallint PRIMARY KEY CHECK (id = 1),
  emisor jsonb NOT NULL,
  ambiente char(2) NOT NULL DEFAULT '00' CHECK (ambiente IN ('00','01')),
  mh_en_linea boolean NOT NULL DEFAULT true,
  simular_rechazo boolean NOT NULL DEFAULT false,
  latencia_ms integer NOT NULL DEFAULT 700 CHECK (latencia_ms BETWEEN 0 AND 5000),
  descuento_base numeric(5,2) NOT NULL DEFAULT 10,
  modo_demo boolean NOT NULL DEFAULT true,
  proximo_reintento timestamptz
);

CREATE TABLE bitacora (
  id bigserial PRIMARY KEY,
  fecha timestamptz NOT NULL DEFAULT now(),
  usuario_id varchar(40) NOT NULL,
  modulo varchar(20) NOT NULL,
  accion varchar(80) NOT NULL,
  detalle text,
  nivel varchar(5) NOT NULL CHECK (nivel IN ('info','ok','warn','error'))
);

CREATE TABLE correo_simulado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha timestamptz NOT NULL DEFAULT now(),
  para varchar(120) NOT NULL,
  asunto varchar(200) NOT NULL,
  cuerpo text NOT NULL,
  enlace varchar(200),
  adjuntos text,
  leido boolean NOT NULL DEFAULT false
);

-- ---------- Auditoría a nivel de base de datos ----------
CREATE TABLE auditoria (
  id bigserial PRIMARY KEY,
  fecha timestamptz NOT NULL DEFAULT now(),
  usuario_db text NOT NULL DEFAULT current_user,
  tabla text NOT NULL,
  operacion char(1) NOT NULL,
  registro jsonb
);

CREATE FUNCTION fn_auditar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO auditoria (tabla, operacion, registro)
  VALUES (TG_TABLE_NAME, left(TG_OP, 1), to_jsonb(COALESCE(NEW, OLD)) - 'password_hash');
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER tg_aud_usuario AFTER INSERT OR UPDATE OF nombre, correo, rol_id, activo, password_hash OR DELETE ON usuario FOR EACH ROW EXECUTE FUNCTION fn_auditar();
CREATE TRIGGER tg_aud_producto AFTER UPDATE OF precio_venta, costo ON producto FOR EACH ROW EXECUTE FUNCTION fn_auditar();
CREATE TRIGGER tg_aud_permiso AFTER INSERT OR UPDATE OR DELETE ON permiso FOR EACH ROW EXECUTE FUNCTION fn_auditar();

CREATE FUNCTION fn_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción (registro inmutable)', TG_TABLE_NAME;
END $$;
CREATE TRIGGER tg_kardex_inmutable BEFORE UPDATE OR DELETE ON kardex FOR EACH ROW EXECUTE FUNCTION fn_inmutable();
CREATE TRIGGER tg_auditoria_inmutable BEFORE UPDATE OR DELETE ON auditoria FOR EACH ROW EXECUTE FUNCTION fn_inmutable();
CREATE TRIGGER tg_dte_no_delete BEFORE DELETE ON dte_encabezado FOR EACH ROW EXECUTE FUNCTION fn_inmutable();

-- ---------- Índices basados en las consultas críticas ----------
CREATE INDEX ix_dte_fecha_tipo   ON dte_encabezado (fecha_emision, tipo_dte) INCLUDE (total_gravada, total_iva, estado);
CREATE INDEX ix_dte_cliente      ON dte_encabezado (cliente_id, fecha_emision DESC) WHERE cliente_id IS NOT NULL;
CREATE INDEX ix_dte_contingencia ON dte_encabezado (fecha_emision) WHERE estado = 'CONTINGENCIA';
CREATE INDEX ix_dte_numero       ON dte_encabezado (numero_control);
CREATE INDEX ix_dte_sello        ON dte_encabezado (sello_recepcion);
CREATE INDEX ix_dte_relacionado  ON dte_encabezado (relacionado_id) WHERE relacionado_id IS NOT NULL;
CREATE INDEX ix_producto_nombre  ON producto (lower(nombre) text_pattern_ops);
CREATE INDEX ix_kardex_producto  ON kardex (producto_id, fecha DESC);
CREATE INDEX ix_venta_turno      ON venta (turno_id);
CREATE INDEX ix_bitacora_fecha   ON bitacora (fecha DESC);
CREATE INDEX ix_dte_bitacora     ON dte_bitacora (codigo_generacion, fecha);

-- Las funciones resuelven objetos en el esquema de la aplicación sin depender del search_path de la sesión
ALTER FUNCTION fn_auditar() SET search_path = ${flyway:defaultSchema};
ALTER FUNCTION fn_inmutable() SET search_path = ${flyway:defaultSchema};
ALTER FUNCTION dui_valido(text) SET search_path = ${flyway:defaultSchema}, public;
