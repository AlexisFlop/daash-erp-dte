-- Índices definidos a partir del análisis de consultas críticas (EXPLAIN ANALYZE).
-- Están incluidos en la migración Flyway V1; el arnés los elimina para medir el "antes" y los recrea con este script.
SET search_path TO daash;
CREATE INDEX IF NOT EXISTS ix_dte_fecha_tipo   ON dte_encabezado (fecha_emision, tipo_dte) INCLUDE (total_gravada, total_iva, estado);
CREATE INDEX IF NOT EXISTS ix_dte_cliente      ON dte_encabezado (cliente_id, fecha_emision DESC) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_dte_contingencia ON dte_encabezado (fecha_emision) WHERE estado = 'CONTINGENCIA';
CREATE INDEX IF NOT EXISTS ix_dte_numero       ON dte_encabezado (numero_control);
CREATE INDEX IF NOT EXISTS ix_dte_sello        ON dte_encabezado (sello_recepcion);
CREATE INDEX IF NOT EXISTS ix_producto_nombre  ON producto (lower(nombre) text_pattern_ops);
CREATE INDEX IF NOT EXISTS ix_kardex_producto  ON kardex (producto_id, fecha DESC);
CREATE INDEX IF NOT EXISTS ix_dte_bitacora     ON dte_bitacora (codigo_generacion, fecha);
ANALYZE;
