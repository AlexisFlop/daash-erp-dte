-- =====================================================================
-- Flyway V2 · Roles de base de datos con mínimo privilegio
-- En servicios administrados donde el usuario no puede crear roles (p. ej. Render),
-- la migración continúa y la aplicación opera con el usuario asignado por el proveedor.
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'daash_app') THEN
    EXECUTE format('CREATE ROLE daash_app LOGIN PASSWORD %L', '${appPassword}');   -- backend Spring Boot
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'daash_reportes') THEN
    CREATE ROLE daash_reportes NOLOGIN;                                             -- libros de IVA / BI
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'daash_respaldo') THEN
    CREATE ROLE daash_respaldo NOLOGIN;                                             -- pg_dump
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Sin privilegio para crear roles: se omite la separación de roles en este entorno';
END $$;

CREATE VIEW v_libro_contribuyentes AS
  SELECT d.fecha_emision, d.tipo_dte, d.numero_control, d.sello_recepcion, c.nrc, d.receptor_nombre,
         CASE WHEN d.tipo_dte = '05' THEN -d.total_gravada ELSE d.total_gravada END AS gravadas,
         CASE WHEN d.tipo_dte = '05' THEN -d.total_iva ELSE d.total_iva END AS debito_fiscal
  FROM dte_encabezado d LEFT JOIN cliente c ON c.id = d.cliente_id
  WHERE d.tipo_dte IN ('03','05') AND d.estado IN ('PROCESADO','CONTINGENCIA');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'daash_app') THEN
    REVOKE ALL ON SCHEMA ${flyway:defaultSchema} FROM PUBLIC;
    GRANT USAGE ON SCHEMA ${flyway:defaultSchema} TO daash_app, daash_reportes, daash_respaldo;
    -- Aplicación: lectura, inserción y actualización; sin borrado salvo tablas de configuración de acceso
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA ${flyway:defaultSchema} TO daash_app;
    REVOKE UPDATE ON kardex, auditoria, dte_bitacora FROM daash_app;
    GRANT DELETE ON permiso, rol, reset_token, venta_detalle, compra_detalle TO daash_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${flyway:defaultSchema} TO daash_app;
    -- Reportería y respaldo: solo lectura; reportería sin acceso a usuarios (hashes)
    GRANT SELECT ON ALL TABLES IN SCHEMA ${flyway:defaultSchema} TO daash_reportes, daash_respaldo;
    REVOKE SELECT ON usuario, reset_token FROM daash_reportes;
    GRANT SELECT ON v_libro_contribuyentes TO daash_reportes;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Sin privilegio para asignar permisos a roles: se omite en este entorno';
END $$;
