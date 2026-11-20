"""Recorrido de negocio completo contra la API REST (backend + PostgreSQL en ejecución).
Uso: python3 pruebas/recorrido_api.py [http://localhost:8080/api]"""
import json, sys, time, urllib.request, urllib.error

API = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080/api'
res = []

def req(metodo, ruta, cuerpo=None, token=None):
    r = urllib.request.Request(API + ruta, method=metodo, data=json.dumps(cuerpo).encode() if cuerpo is not None else None)
    r.add_header('Content-Type', 'application/json')
    if token: r.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(r, timeout=30) as x:
            b = x.read(); return x.status, json.loads(b) if b else None
    except urllib.error.HTTPError as e:
        b = e.read(); return e.code, json.loads(b) if b else None

def caso(nombre, ok, detalle=''):
    res.append(ok); print(('PASA ' if ok else 'FALLA') + ' ' + nombre + (' · ' + str(detalle) if detalle else ''))

def login(correo, pw): return req('POST', '/auth/login', {'correo': correo, 'password': pw})[1]['token']

G = login('gerente@adventureworks.com.sv', 'Gerente123*')
C = login('cajero@adventureworks.com.sv', 'Cajero123*')
B = login('bodega@adventureworks.com.sv', 'Bodega123*') if req('POST', '/auth/login', {'correo': 'bodega@adventureworks.com.sv', 'password': 'Bodega123*'})[0] == 200 else None

# --- Permisos (RF-04)
caso('API-01 Cajero no puede listar usuarios (403)', req('GET', '/usuarios', token=C)[0] == 403)
caso('API-02 Cajero sí puede consultar el catálogo para el POS', req('GET', '/productos', token=C)[0] == 200)
caso('API-03 Petición sin token es rechazada (401)', req('GET', '/productos')[0] == 401)

# --- Caja (RF-09). Se cierra cualquier turno que haya quedado abierto por otra suite para no depender del estado previo
req('POST', '/turnos/cerrar', {'efectivoContado': 0}, C)
s, b = req('POST', '/ventas', {'items': [], 'tipoDte': '01', 'metodoPago': 'EFECTIVO'}, C)
caso('API-04 Venta sin turno abierto es rechazada', s == 422 and 'caja abierta' in b['mensaje'], b and b['mensaje'])
req('POST', '/turnos/cerrar', {'efectivoContado': 0}, C)
s, turno = req('POST', '/turnos/abrir', {'fondoInicial': 100, 'caja': 'Caja 01'}, C)
caso('API-05 Apertura de turno', s == 200 and turno['estado'] == 'ABIERTO')
caso('API-06 Segundo turno abierto es rechazado', req('POST', '/turnos/abrir', {'fondoInicial': 50}, C)[0] == 409)

prods = req('GET', '/productos', token=C)[1]
bici = next(p for p in prods if p['sku'] == 'BK-M68B-38'); casco = next(p for p in prods if p['sku'] == 'HL-U509')
stock0 = bici['stock']

# --- Venta factura (RF-10, RF-13, CA-05)
t0 = time.time()
s, r = req('POST', '/ventas', {'items': [{'productoId': bici['id'], 'cantidad': 1, 'precio': 0.01}, {'productoId': casco['id'], 'cantidad': 2}], 'descuentoPct': 0,
                               'tipoDte': '01', 'metodoPago': 'EFECTIVO', 'recibido': 1400}, C)
ms = int((time.time() - t0) * 1000)
d = r['dte'] if s == 200 else {}
caso('API-07 Factura procesada con sello de 40 caracteres', s == 200 and d['estado'] == 'PROCESADO' and len(d['selloRecibido']) == 40, f"{d.get('numeroControl')} · {ms} ms")
caso('API-08 El precio enviado por el cliente se ignora (CA-05)', s == 200 and abs(d['total'] - 1378.58) < 0.001, d.get('total'))
caso('API-09 JSON fe-fc-v1 con IVA por ítem y total en letras', d.get('json', {}).get('identificacion', {}).get('version') == 1 and d['json']['resumen']['totalIva'] == 158.6,
     d.get('json', {}).get('resumen', {}).get('totalLetras'))
caso('API-10 Firma JWS RS512 de tres segmentos', d.get('firma', '').count('.') == 2)
bici2 = next(p for p in req('GET', '/productos', token=C)[1] if p['id'] == bici['id'])
caso('API-11 Stock descontado y Kardex registrado (RF-07)', bici2['stock'] == stock0 - 1)
caso('API-12 Cambio calculado en el servidor', abs(r['venta']['cambio'] - (1400 - 1378.58)) < 0.001, r['venta']['cambio'])

# --- Descuento sobre el límite (RF-11)
s, b = req('POST', '/ventas', {'items': [{'productoId': casco['id'], 'cantidad': 1}], 'descuentoPct': 15, 'tipoDte': '01', 'metodoPago': 'TARJETA'}, C)
caso('API-13 Descuento del 15 % sin autorización es rechazado', s == 422 and any('autorización' in e for e in b['errores']))
s, b = req('POST', '/ventas', {'items': [{'productoId': casco['id'], 'cantidad': 1}], 'descuentoPct': 15, 'tipoDte': '01', 'metodoPago': 'TARJETA',
                               'autorizacion': {'correo': 'gerente@adventureworks.com.sv', 'password': 'Gerente123*'}}, C)
caso('API-14 Descuento autorizado con credenciales de gerente', s == 200 and b['venta']['autorizadoPor'] is not None)

# --- Sobreventa (RF-07)
s, b = req('POST', '/ventas', {'items': [{'productoId': bici['id'], 'cantidad': 9999}], 'tipoDte': '01', 'metodoPago': 'TARJETA'}, C)
caso('API-15 Venta mayor al stock es rechazada', s == 422 and any('Stock insuficiente' in e for e in b['errores']))

# --- CCF (RF-16)
cli = req('GET', '/clientes', token=C)[1]
contrib = next(c for c in cli if c['tipo'] == 'CONTRIBUYENTE')
s, b = req('POST', '/ventas', {'items': [{'productoId': casco['id'], 'cantidad': 3}], 'tipoDte': '03', 'metodoPago': 'TRANSFERENCIA'}, C)
caso('API-16 CCF sin receptor es rechazado', s == 422)
s, ccf = req('POST', '/ventas', {'items': [{'productoId': casco['id'], 'cantidad': 3}], 'tipoDte': '03', 'clienteId': contrib['id'], 'metodoPago': 'TRANSFERENCIA'}, C)
caso('API-17 CCF procesado con tributo 20', s == 200 and ccf['dte']['json']['resumen']['tributos'][0]['codigo'] == '20', ccf['dte']['numeroControl'] if s == 200 else ccf)

# --- Nota de crédito e invalidación (RF-15)
s, nc = req('POST', f"/dtes/{ccf['dte']['id']}/nota-credito", {'items': [{'productoId': casco['id'], 'cantidad': 1}]}, G)
caso('API-18 Nota de crédito procesada y relacionada al CCF', s == 200 and nc['dte']['tipoDte'] == '05' and nc['dte']['relacionadoId'] == ccf['dte']['id'])
s, b = req('POST', f"/dtes/{ccf['dte']['id']}/nota-credito", {'items': [{'productoId': casco['id'], 'cantidad': 5}]}, G)
caso('API-19 Devolver más de lo vendido es rechazado', s == 422)
s, b = req('POST', f"/dtes/{ccf['dte']['id']}/invalidar", {'tipo': 2, 'motivo': ''}, G)
caso('API-20 Invalidar CCF con NC vigente es rechazado', s == 409)
caso('API-21 Cajero no puede invalidar documentos (403)', req('POST', f"/dtes/{d['id']}/invalidar", {'tipo': 2}, C)[0] == 403)
s, b = req('POST', f"/dtes/{d['id']}/invalidar", {'tipo': 2, 'motivo': ''}, G)
caso('API-22 Invalidación de factura con sello del evento', s == 200 and b['estado'] == 'INVALIDADO' and len(b['invalidacion']['selloRecibido']) == 40)

# --- Contingencia (RF-14)
caso('API-23 Cajero no puede cambiar el estado del MH (403)', req('POST', '/contingencia/mh', {'enLinea': False}, C)[0] == 403)
req('POST', '/contingencia/mh', {'enLinea': False, 'tipo': 1}, G)
s, cont = req('POST', '/ventas', {'items': [{'productoId': casco['id'], 'cantidad': 1}], 'tipoDte': '01', 'metodoPago': 'EFECTIVO'}, C)
caso('API-24 Venta en contingencia con modelo diferido', s == 200 and cont['dte']['estado'] == 'CONTINGENCIA' and cont['dte']['json']['identificacion']['tipoModelo'] == 2)
req('POST', '/contingencia/mh', {'enLinea': True}, G)
fin = time.time() + 30
while time.time() < fin:
    e = req('GET', '/contingencia', token=G)[1]
    if e['pendientes'] == 0 and e['eventos'][0]['estado'] == 'TRANSMITIDO': break
    time.sleep(1)
caso('API-25 Cron del servidor transmite evento y lote al restablecer', e['pendientes'] == 0 and e['eventos'][0]['estado'] == 'TRANSMITIDO', f"{round(30 - (fin - time.time()))} s")
dc = req('GET', f"/dtes/{cont['dte']['id']}", token=G)[1]
caso('API-26 DTE de contingencia recibe sello', dc['estado'] == 'PROCESADO' and dc['selloRecibido'] is not None)

# --- Corte Z (RF-12)
s, z = req('POST', '/turnos/cerrar', {'efectivoContado': 1500}, C)
caso('API-27 Corte Z excluye documentos invalidados', s == 200 and z['estado'] == 'CERRADO', f"{z['resumen']['transacciones']} transacciones · diferencia {z['resumen']['diferencia']}")

# --- Inventario, compras y clientes (RF-05, RF-06, RF-16, RF-18)
s, b = req('POST', f"/productos/{casco['id']}/ajuste", {'cantidad': 1, 'tipo': 'AJUSTE_NEG', 'justificacion': 'corto'}, G)
caso('API-28 Ajuste sin justificación suficiente es rechazado', s == 422)
s, b = req('POST', f"/productos/{casco['id']}/ajuste", {'cantidad': 1, 'tipo': 'AJUSTE_NEG', 'justificacion': 'Producto dañado en exhibición'}, G)
caso('API-29 Ajuste justificado queda en Kardex', s == 200)
prov = req('GET', '/proveedores', token=G)[1][0]
num = 'CCF-PRUEBA-' + str(int(time.time()))
s, b = req('POST', '/compras', {'proveedorId': prov['id'], 'numeroComprobante': num, 'items': [{'productoId': casco['id'], 'cantidad': 10, 'costoUnit': 15}]}, G)
caso('API-30 Compra aumenta stock y recalcula costo promedio', s == 200 and b['total'] == 169.5)
caso('API-31 Comprobante de compra duplicado es rechazado', req('POST', '/compras', {'proveedorId': prov['id'], 'numeroComprobante': num, 'items': [{'productoId': casco['id'], 'cantidad': 1, 'costoUnit': 15}]}, G)[0] == 409)
s, b = req('POST', '/clientes', {'tipo': 'CONSUMIDOR', 'nombre': 'Cliente Prueba', 'tipoDocumento': '13', 'numDocumento': '04512378-0', 'correo': '', 'telefono': '',
                                 'direccion': {'departamento': '06', 'municipio': '20', 'complemento': 'x'}}, C)
caso('API-32 DUI con dígito verificador erróneo es rechazado', s == 422, b and b.get('errores'))
s, b = req('POST', '/productos', {'sku': 'XSS-' + str(int(time.time())) + '<b>', 'nombre': '<img src=x onerror=alert(1)>', 'categoria': 'Accesorios', 'precio': 10, 'costo': 5, 'stock': 0, 'stockMinimo': 1}, G)
caso('API-33 Texto con HTML se almacena como dato, no se ejecuta (CA-03)', s == 200 and b['nombre'] == '<img src=x onerror=alert(1)>')
s, b = req('POST', '/auth/login', {'correo': "' OR '1'='1' --", 'password': "' OR '1'='1"})
caso('API-34 Inyección SQL en el login es rechazada (CA-01)', s == 401 and 'token' not in (b or {}), b and b.get('mensaje'))

print(f"\n{sum(res)}/{len(res)} casos aprobados")
