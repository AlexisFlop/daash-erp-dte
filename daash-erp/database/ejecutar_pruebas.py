"""Arnés de pruebas de la BD: levanta PostgreSQL 16 en Docker, aplica el esquema real de las migraciones Flyway (V1, V2) y mide resultados.
Uso: python3 ejecutar_pruebas.py  → escribe resultados_pruebas.json"""
import json, statistics, subprocess, time, pathlib
C = 'daash-pg-pruebas'
AQUI = pathlib.Path(__file__).parent

def sh(cmd, inp=None, check=True):
    return subprocess.run(cmd, input=inp, capture_output=True, text=True, check=check)

def psql(sql, db='daash', fmt=('-At',)):
    return sh(['docker', 'exec', '-i', C, 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', *fmt], sql).stdout

def archivo(n):
    t = time.time(); psql((AQUI / n).read_text()); return round(time.time() - t, 1)

CONSULTAS = {
    'Q1 Libro de ventas a contribuyentes (1 mes)': "SELECT count(*), sum(gravadas), sum(debito_fiscal) FROM daash.v_libro_contribuyentes WHERE fecha_emision BETWEEN '2026-10-01' AND '2026-10-31'",
    'Q2 Búsqueda por número de control': "SELECT * FROM daash.dte_encabezado WHERE numero_control = 'DTE-01-M001P001-000000000250000'",
    'Q3 Historial de documentos de un cliente': "SELECT d.numero_control, d.total_pagar FROM daash.dte_encabezado d WHERE d.cliente_id = (SELECT id FROM daash.cliente WHERE nombre LIKE 'Empresa 1234,%') ORDER BY fecha_emision DESC LIMIT 50",
    'Q4 Cola de DTE en contingencia': "SELECT codigo_generacion FROM daash.dte_encabezado WHERE estado = 'CONTINGENCIA'",
    'Q5 Búsqueda de producto en POS (prefijo)': "SELECT sku, nombre, precio_venta, stock FROM daash.producto WHERE lower(nombre) LIKE 'producto 12%' LIMIT 20",
    'Q6 Ventas por día del mes (dashboard)': "SELECT fecha_emision, sum(total_pagar) FROM daash.dte_encabezado WHERE fecha_emision >= '2026-11-01' AND fecha_emision < '2026-12-01' AND estado <> 'INVALIDADO' GROUP BY 1",
    'Q7 Consulta por sello de recepción': "SELECT numero_control FROM daash.dte_encabezado WHERE sello_recepcion = '{SELLO}'",
}

def medir():
    r = {}
    sello = psql("SELECT sello_recepcion FROM daash.dte_2025 OFFSET 123456 LIMIT 1").strip()
    for k, q in CONSULTAS.items():
        q = q.replace('{SELLO}', sello)
        ts = []
        for _ in range(7):
            plan = json.loads(psql('EXPLAIN (ANALYZE, FORMAT JSON) ' + q))
            ts.append(plan[0]['Execution Time'])
        r[k] = round(statistics.median(ts[2:]), 2)   # descarta 2 corridas de calentamiento
    return r

res = {}
sh(['docker', 'rm', '-f', C], check=False)
sh(['docker', 'run', '-d', '--name', C, '-e', 'POSTGRES_PASSWORD=demo', '-e', 'POSTGRES_DB=daash', 'postgres:16-alpine'])
for _ in range(60):
    if sh(['docker', 'exec', C, 'pg_isready', '-U', 'postgres'], check=False).returncode == 0: break
    time.sleep(1)
time.sleep(2)
res['version'] = psql('SELECT version()').strip()
res['tiempo_esquema_s'] = archivo('01_esquema.sql')
res['tiempo_seguridad_s'] = archivo('02_seguridad.sql')
res['tiempo_carga_s'] = archivo('03_datos_prueba.sql')
res['volumen'] = dict(l.split('|') for l in psql("""SELECT 'dte', count(*) FROM daash.dte_encabezado UNION ALL SELECT 'clientes', count(*) FROM daash.cliente
  UNION ALL SELECT 'productos', count(*) FROM daash.producto UNION ALL SELECT 'usuarios', count(*) FROM daash.usuario
  UNION ALL SELECT 'particiones', count(*) FROM pg_inherits WHERE inhparent = 'daash.dte_encabezado'::regclass""").split())
res['tamano_bd'] = psql("SELECT pg_size_pretty(pg_database_size('daash'))").strip()
# Los índices vienen en la migración V1: se eliminan para medir el "antes" y se recrean con 04_indices.sql
psql("SET search_path TO daash; DROP INDEX IF EXISTS ix_dte_fecha_tipo, ix_dte_cliente, ix_dte_contingencia, ix_dte_numero, ix_dte_sello, ix_producto_nombre, ix_kardex_producto, ix_dte_bitacora; ANALYZE;")
res['antes_indices_ms'] = medir()
res['tiempo_indices_s'] = archivo('04_indices.sql')
res['despues_indices_ms'] = medir()
res['poda_particiones'] = 'dte_2026' in psql("EXPLAIN " + CONSULTAS['Q6 Ventas por día del mes (dashboard)']) and 'dte_2025' not in psql("EXPLAIN " + CONSULTAS['Q6 Ventas por día del mes (dashboard)'])
res['integridad'] = [l for l in psql((AQUI / '05_pruebas_integridad.sql').read_text()).splitlines() if l.startswith(('OK', 'FALLA'))]
# Respaldo y restauración
t = time.time(); sh(['docker', 'exec', C, 'pg_dump', '-U', 'postgres', '-Fc', '-Z', '6', '-f', '/tmp/daash.dump', 'daash']); res['respaldo_s'] = round(time.time() - t, 1)
res['respaldo_tamano'] = sh(['docker', 'exec', C, 'du', '-h', '/tmp/daash.dump']).stdout.split()[0]
psql('CREATE DATABASE daash_restaurada', db='postgres')
t = time.time(); sh(['docker', 'exec', C, 'pg_restore', '-U', 'postgres', '-d', 'daash_restaurada', '-j', '4', '/tmp/daash.dump'], check=False); res['restauracion_s'] = round(time.time() - t, 1)
orig = psql("SELECT count(*), sum(total_pagar) FROM daash.dte_encabezado").strip()
rest = psql("SELECT count(*), sum(total_pagar) FROM daash.dte_encabezado", db='daash_restaurada').strip()
res['restauracion_verificada'] = {'original': orig, 'restaurada': rest, 'coincide': orig == rest}
(AQUI / 'resultados_pruebas.json').write_text(json.dumps(res, indent=2, ensure_ascii=False))
sh(['docker', 'rm', '-f', C], check=False)
print(json.dumps(res, indent=2, ensure_ascii=False))
