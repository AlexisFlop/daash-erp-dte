import { describe, expect, it } from 'vitest'
import { calcularTotales, construirDteJson, numeroControl, validarDte } from '../dte'
import { CLIENTES, CONFIG } from '../seed'
import type { ItemVenta } from '../types'
import { completarDUI, numeroALetras, validarDUI, validarNIT, validarNRC } from '../utils'

const bici: ItemVenta = { productoId: 'p1', sku: 'BK-M68B-38', nombre: 'Mountain-200 Black, 38', cantidad: 1, precio: 1150 }
const casco: ItemVenta = { productoId: 'p2', sku: 'HL-U509', nombre: 'Sport-100 Helmet', cantidad: 2, precio: 34.99 }
const contribuyente = CLIENTES.find((c) => c.tipo === 'CONTRIBUYENTE')!

describe('Validación de documentos de identidad (RF-16)', () => {
  it('acepta un DUI con dígito verificador correcto', () => expect(validarDUI(completarDUI('04512378'))).toBe(true))
  it('rechaza un DUI con dígito verificador incorrecto', () => {
    const ok = completarDUI('04512378')
    const malo = ok.slice(0, -1) + ((Number(ok.at(-1)) + 1) % 10)
    expect(validarDUI(malo)).toBe(false)
  })
  it('rechaza un DUI sin guion', () => expect(validarDUI('045123780')).toBe(false))
  it('acepta NIT de 14 dígitos con formato', () => expect(validarNIT('0614-150318-102-7')).toBe(true))
  it('rechaza NIT incompleto', () => expect(validarNIT('0614-1503-102-7')).toBe(false))
  it('acepta NRC válido', () => expect(validarNRC('254871-3')).toBe(true))
  it('rechaza NRC sin dígito verificador', () => expect(validarNRC('254871')).toBe(false))
})

describe('Cálculo de IVA y totales (RF-10)', () => {
  it('Factura: precio con IVA incluido', () => {
    const t = calcularTotales([bici], 0, '01')
    expect(t.lineas[0].precioUni).toBe(1299.5)
    expect(t.total).toBe(1299.5)
    expect(t.iva).toBe(149.5)
  })
  it('CCF: IVA 13% sobre el subtotal', () => {
    const t = calcularTotales([bici, casco], 0, '03')
    expect(t.gravada).toBe(1219.98)
    expect(t.iva).toBe(158.6)
    expect(t.total).toBe(1378.58)
  })
  it('aplica descuento porcentual por línea (RF-11)', () => {
    const t = calcularTotales([bici], 10, '03')
    expect(t.descuento).toBe(115)
    expect(t.total).toBe(1169.55)
  })
  it('limita el descuento entre 0 y 100%', () => {
    expect(calcularTotales([bici], 150, '03').total).toBe(0)
    expect(calcularTotales([bici], -5, '03').total).toBe(1299.5)
  })
  it('subtotal + IVA = total en factura con varios ítems', () => {
    const t = calcularTotales([bici, casco], 5, '01')
    expect(Math.round((t.gravada + t.iva) * 100) / 100).toBe(t.total)
  })
})

describe('Estructura del DTE (RF-13)', () => {
  const base = { config: CONFIG, correlativo: 7, codigoGeneracion: 'A1B2C3D4-0000-4000-8000-000000000001', fecha: new Date('2026-11-20T10:30:00'), descuentoPct: 0, vendedor: 'QA', metodoPago: 'EFECTIVO' as const }
  it('número de control con formato DTE-XX-XXXXXXXX-15 dígitos', () => {
    expect(numeroControl('01', CONFIG.emisor, 7)).toMatch(/^DTE-01-[A-Z0-9]{8}-\d{15}$/)
  })
  it('Factura usa esquema versión 1 y modelo previo', () => {
    const j = construirDteJson({ ...base, tipo: '01', items: [bici] })
    expect(j.identificacion.version).toBe(1)
    expect(j.identificacion.tipoModelo).toBe(1)
    expect(j.resumen.totalLetras).toBe('MIL DOSCIENTOS NOVENTA Y NUEVE 50/100 USD')
  })
  it('CCF usa versión 3 e incluye tributo 20 (IVA)', () => {
    const j = construirDteJson({ ...base, tipo: '03', items: [bici], cliente: contribuyente })
    expect(j.identificacion.version).toBe(3)
    expect(j.resumen.tributos?.[0]).toMatchObject({ codigo: '20', valor: 149.5 })
  })
  it('en contingencia usa modelo diferido y operación 2 (RF-14)', () => {
    const j = construirDteJson({ ...base, tipo: '01', items: [bici], contingencia: { tipo: 1, motivo: '' } })
    expect(j.identificacion.tipoModelo).toBe(2)
    expect(j.identificacion.tipoOperacion).toBe(2)
    expect(j.identificacion.tipoContingencia).toBe(1)
  })
  it('NIT y NRC del emisor se envían sin guiones', () => {
    const j = construirDteJson({ ...base, tipo: '01', items: [bici] })
    expect(j.emisor.nit).toMatch(/^\d{14}$/)
  })
})

describe('Validación previa a la transmisión', () => {
  it('CCF sin receptor es rechazado', () => expect(validarDte('03', undefined, [bici]).length).toBeGreaterThan(0))
  it('CCF con contribuyente válido pasa', () => expect(validarDte('03', contribuyente, [bici])).toEqual([]))
  it('documento sin ítems es rechazado', () => expect(validarDte('01', undefined, [])).toContain('[cuerpoDocumento] El documento debe contener al menos un ítem'))
})

describe('Valor en letras', () => {
  it.each([
    [1, 'UN 00/100 USD'],
    [21000, 'VEINTIUN MIL 00/100 USD'],
    [100, 'CIEN 00/100 USD'],
    [1378.58, 'MIL TRESCIENTOS SETENTA Y OCHO 58/100 USD'],
  ])('%d → %s', (n, txt) => expect(numeroALetras(n)).toBe(txt))
})
