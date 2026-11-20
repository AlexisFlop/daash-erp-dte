-- Casos de prueba de integridad: cada bloque DEBE fallar. Se reporta OK si la BD lo rechaza.
SET search_path TO daash;
CREATE OR REPLACE FUNCTION probar(nombre text, sentencia text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE sentencia;
  RETURN 'FALLA  | ' || nombre || ' (la BD aceptó un dato inválido)';
EXCEPTION WHEN OTHERS THEN
  RETURN 'OK     | ' || nombre || ' → ' || left(SQLERRM, 70);
END $$;

SELECT probar('IT-01 DUI con dígito verificador erróneo',
  $q$INSERT INTO cliente (tipo,nombre,tipo_documento,num_documento,departamento,municipio) VALUES ('CONSUMIDOR','X','13','04512378-0','06','20')$q$);
SELECT probar('IT-02 NIT con formato inválido',
  $q$INSERT INTO proveedor (razon_social,nit,nrc,contacto,telefono) VALUES ('X','0614-1234','1-1','c','2222-2222')$q$);
SELECT probar('IT-03 Contribuyente sin NRC',
  $q$INSERT INTO cliente (tipo,nombre,tipo_documento,num_documento,correo,departamento,municipio) VALUES ('CONTRIBUYENTE','X','36','0614-000000-000-1','a@b.sv','06','20')$q$);
SELECT probar('IT-04 Stock negativo (sobreventa)',
  $q$UPDATE producto SET stock = -1 WHERE sku = 'SKU-00001'$q$);
SELECT probar('IT-05 Ajuste de Kardex sin justificación',
  $q$INSERT INTO kardex (producto_id,tipo,cantidad,saldo,costo_unitario,referencia,usuario_id) SELECT p.id,'AJUSTE_NEG',1,1,1,'x',u.id FROM producto p, usuario u LIMIT 1$q$);
SELECT probar('IT-06 Modificar un movimiento de Kardex',
  $q$DO $d$ DECLARE k bigint; BEGIN INSERT INTO kardex (producto_id,tipo,cantidad,saldo,costo_unitario,referencia,usuario_id) SELECT p.id,'ENTRADA',1,1,1,'x',u.id FROM producto p, usuario u LIMIT 1 RETURNING id INTO k; UPDATE kardex SET cantidad = 99 WHERE id = k; END $d$$q$);
SELECT probar('IT-07 Eliminar un DTE',
  $q$DELETE FROM dte_encabezado WHERE codigo_generacion = (SELECT codigo_generacion FROM dte_encabezado LIMIT 1)$q$);
SELECT probar('IT-08 DTE procesado sin sello de recepción',
  $q$INSERT INTO dte_encabezado (codigo_generacion,fecha_emision,hora_emision,tipo_dte,numero_control,usuario_id,receptor_nombre,total_gravada,total_iva,total_pagar,estado,tipo_modelo,documento_json,firma_jws) SELECT gen_random_uuid(),'2026-11-20','10:00','01','DTE-01-M001P001-999999999999999',id,'CF',1,0.13,1.13,'PROCESADO',1,'{}','x' FROM usuario LIMIT 1$q$);
SELECT probar('IT-09 Número de control con formato inválido',
  $q$INSERT INTO dte_encabezado (codigo_generacion,fecha_emision,hora_emision,tipo_dte,numero_control,usuario_id,receptor_nombre,total_gravada,total_iva,total_pagar,estado,tipo_modelo,documento_json,firma_jws) SELECT gen_random_uuid(),'2026-11-20','10:00','01','FAC-0001',id,'CF',1,0.13,1.13,'CONTINGENCIA',2,'{}','x' FROM usuario LIMIT 1$q$);
SELECT probar('IT-10 Dos turnos abiertos para el mismo cajero',
  $q$INSERT INTO turno_caja (usuario_id,caja,fondo_inicial) SELECT id,'C1',100 FROM usuario WHERE rol_id='cajero' LIMIT 1; INSERT INTO turno_caja (usuario_id,caja,fondo_inicial) SELECT id,'C2',100 FROM usuario WHERE rol_id='cajero' LIMIT 1$q$);
SELECT probar('IT-11 CCF sin cliente',
  $q$WITH t AS (INSERT INTO turno_caja (usuario_id,caja,fondo_inicial) SELECT id,'C9',100 FROM usuario WHERE rol_id='bodega' LIMIT 1 RETURNING id, usuario_id)
     INSERT INTO venta (turno_id,usuario_id,tipo_dte,metodo_pago,subtotal,iva,total) SELECT t.id,t.usuario_id,'03','EFECTIVO',1,0.13,1.13 FROM t$q$);
SELECT probar('IT-12 Contingencia tipo 5 sin motivo',
  $q$INSERT INTO evento_contingencia (id,f_inicio,tipo_contingencia,estado) VALUES (gen_random_uuid(),now(),5,'ACTIVO')$q$);
SELECT probar('IT-13 Permiso de escritura sin lectura',
  $q$INSERT INTO permiso (rol_id,modulo,crear,leer) VALUES ('cajero','usuarios',true,false)$q$);
SELECT probar('IT-14 Correo de usuario duplicado (mayúsculas)',
  $q$INSERT INTO usuario (nombre,correo,password_hash,dui,rol_id,sucursal_id) SELECT 'X', upper(correo), 'h', dui, rol_id, sucursal_id FROM usuario LIMIT 1$q$);
SELECT probar('IT-15 Rol de reportes lee hashes de contraseña',
  $q$SET LOCAL ROLE daash_reportes; SELECT password_hash FROM daash.usuario LIMIT 1$q$);
SELECT probar('IT-16 Rol de la aplicación borra auditoría',
  $q$SET LOCAL ROLE daash_app; DELETE FROM daash.auditoria$q$);
SELECT probar('IT-17 Producto con código de barras duplicado',
  $q$INSERT INTO producto (sku,codigo_barras,nombre,categoria_id,precio_venta,costo) SELECT 'SKU-DUP', codigo_barras, 'Duplicado', categoria_id, 1, 1 FROM producto LIMIT 1$q$);
SELECT probar('IT-18 Dos eventos de contingencia activos a la vez',
  $q$INSERT INTO evento_contingencia (id,f_inicio,tipo_contingencia,estado) VALUES (gen_random_uuid(),now(),1,'ACTIVO'); INSERT INTO evento_contingencia (id,f_inicio,tipo_contingencia,estado) VALUES (gen_random_uuid(),now(),1,'ACTIVO')$q$);
