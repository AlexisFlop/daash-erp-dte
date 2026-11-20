-- Volumen de prueba: catálogo base + 3 años de documentos (~600 mil DTE)
SET search_path TO daash;
INSERT INTO sucursal (nombre, cod_establecimiento, cod_punto_venta) VALUES
  ('Casa Matriz', 'M001', 'P001'), ('Santa Tecla', 'M002', 'P001'), ('San Miguel', 'M003', 'P001');
INSERT INTO rol (id, nombre, sistema, autoriza_descuentos) VALUES
  ('gerente','Gerente',true,true), ('cajero','Cajero',true,false), ('bodega','Bodega',true,false), ('auditor','Auditor',true,false);
INSERT INTO categoria (nombre) VALUES ('Bicicletas'),('Componentes'),('Accesorios'),('Ropa'),('Repuestos');
INSERT INTO usuario (nombre, correo, password_hash, dui, rol_id, sucursal_id)
  SELECT 'Usuario ' || i, 'usuario' || i || '@adventureworks.com.sv', crypt('Demo123*', gen_salt('bf', 8)),
         d || '-' || ((10 - (SELECT sum(substr(d, k, 1)::int * (10 - k)) FROM generate_series(1,8) k) % 10) % 10),
         (ARRAY['gerente','cajero','cajero','bodega','auditor'])[1 + i % 5], 1 + i % 3
  FROM generate_series(1, 25) i, LATERAL (SELECT lpad((10000000 + i * 7919)::text, 8, '0') d) x;
INSERT INTO producto (sku, codigo_barras, nombre, categoria_id, precio_venta, costo, stock, stock_minimo)
  SELECT 'SKU-' || lpad(i::text, 5, '0'), '7410' || lpad(i::text, 8, '0'), 'Producto ' || i, 1 + i % 5,
         round((5 + random() * 1500)::numeric, 2), round((3 + random() * 900)::numeric, 2), (random() * 200)::int, 5
  FROM generate_series(1, 1500) i;
INSERT INTO cliente (tipo, nombre, tipo_documento, num_documento, nrc, cod_actividad, correo, departamento, municipio)
  SELECT 'CONTRIBUYENTE', 'Empresa ' || i || ', S.A. de C.V.', '36',
         '0614-' || lpad((100000 + i)::text, 6, '0') || '-' || lpad((i % 999)::text, 3, '0') || '-' || (i % 10),
         (100000 + i) || '-' || (i % 10), '47630', 'empresa' || i || '@correo.sv', '06', '20'
  FROM generate_series(1, 4000) i;

-- DTE: 550 por día durante 3 años
INSERT INTO dte_encabezado (codigo_generacion, fecha_emision, hora_emision, tipo_dte, numero_control, cliente_id, usuario_id, receptor_nombre,
                            total_gravada, total_iva, total_pagar, estado, tipo_modelo, sello_recepcion, fh_procesamiento, documento_json, firma_jws)
SELECT gen_random_uuid(), f, make_time(8 + (n % 11), n % 60, 0), t,
       'DTE-' || t || '-M001P001-' || lpad(row_number() OVER (PARTITION BY t ORDER BY f, n)::text, 15, '0'),
       CASE WHEN t = '03' THEN c.id END, (SELECT id FROM usuario ORDER BY correo LIMIT 1), COALESCE(c.nombre, 'Consumidor final'),
       g, round(g * 0.13, 2), round(g * 1.13, 2),
       CASE WHEN n % 997 = 0 THEN 'INVALIDADO' ELSE 'PROCESADO' END, 1,
       upper(substr(md5(random()::text) || md5(random()::text), 1, 40)), to_char(f + interval '10 hours', 'DD/MM/YYYY HH24:MI:SS'),
       jsonb_build_object('identificacion', jsonb_build_object('tipoDte', t, 'version', CASE t WHEN '01' THEN 1 ELSE 3 END), 'resumen', jsonb_build_object('totalPagar', round(g * 1.13, 2))),
       'eyJhbGciOiJSUzUxMiJ9.demo.firma'
FROM generate_series(date '2024-01-01', date '2026-12-31', interval '1 day') f,
     generate_series(1, 550) n,
     LATERAL (SELECT CASE WHEN n % 5 = 0 THEN '03' ELSE '01' END t, round((10 + random() * 900)::numeric, 2) g) v
LEFT JOIN LATERAL (SELECT id, nombre FROM cliente WHERE v.t = '03' OFFSET (n * 7) % 4000 LIMIT 1) c ON true;
ANALYZE;
