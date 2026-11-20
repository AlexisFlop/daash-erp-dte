"""Prueba de concurrencia: N ventas simultáneas de un producto con stock limitado.
Verifica que el bloqueo pesimista de filas (SELECT ... FOR UPDATE) impide la sobreventa (RF-07).
Uso: python3 pruebas/concurrencia.py [http://localhost:8080/api] [solicitudes] [stock]"""
import json, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

API = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080/api'
N = int(sys.argv[2]) if len(sys.argv) > 2 else 20
STOCK = int(sys.argv[3]) if len(sys.argv) > 3 else 5

def req(m, ruta, cuerpo=None, token=None):
    r = urllib.request.Request(API + ruta, method=m, data=json.dumps(cuerpo).encode() if cuerpo is not None else None)
    r.add_header('Content-Type', 'application/json')
    if token: r.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(r, timeout=60) as x: return x.status, json.loads(x.read() or b'null')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'null')

G = req('POST', '/auth/login', {'correo': 'gerente@adventureworks.com.sv', 'password': 'Gerente123*'})[1]['token']
sku = 'CONC-' + str(int(time.time()))
s, p = req('POST', '/productos', {'sku': sku, 'nombre': 'Producto prueba concurrencia', 'categoria': 'Accesorios', 'precio': 10, 'costo': 5, 'stock': STOCK, 'stockMinimo': 0}, G)
assert s == 200, p
req('POST', '/turnos/cerrar', {'efectivoContado': 0}, G)
req('POST', '/turnos/abrir', {'fondoInicial': 0, 'caja': 'Caja 03'}, G)

def vender(_):
    t = time.time()
    s, b = req('POST', '/ventas', {'items': [{'productoId': p['id'], 'cantidad': 1}], 'tipoDte': '01', 'metodoPago': 'TARJETA'}, G)
    return s, (time.time() - t) * 1000

t0 = time.time()
with ThreadPoolExecutor(max_workers=N) as ex: r = list(ex.map(vender, range(N)))
total = time.time() - t0
ok = sum(1 for s, _ in r if s == 200); rech = sum(1 for s, _ in r if s == 422); otros = N - ok - rech
final = next(x for x in req('GET', '/productos', token=G)[1] if x['id'] == p['id'])['stock']
req('POST', '/turnos/cerrar', {'efectivoContado': 0}, G)
lat = sorted(ms for _, ms in r)
print(json.dumps({'solicitudes': N, 'stock_inicial': STOCK, 'aceptadas': ok, 'rechazadas_por_stock': rech, 'otros_errores': otros, 'stock_final': final,
                  'sobreventa': final < 0 or ok > STOCK, 'tiempo_total_s': round(total, 2), 'latencia_mediana_ms': round(lat[len(lat) // 2]), 'latencia_max_ms': round(lat[-1])}, indent=2))
print('PASA' if ok == STOCK and final == 0 and otros == 0 else 'FALLA')
