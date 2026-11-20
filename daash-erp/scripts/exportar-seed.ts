// Exporta los datos de demostración del frontend a JSON para el seeder del backend.
import { writeFileSync, mkdirSync } from 'node:fs'
import { CLIENTES, CREDENCIALES_DEMO, PROVEEDORES, ROLES, USUARIOS, generarHistorial } from '../src/lib/seed'

const h = generarHistorial()
const destino = process.argv[2]
const passwords: Record<string, string> = Object.fromEntries(CREDENCIALES_DEMO.map((c) => [c.correo, c.password]))
passwords['cajero2@adventureworks.com.sv'] = 'Cajero123*'
const datos = {
  generado: new Date().toISOString(),
  roles: ROLES,
  usuarios: USUARIOS.map(({ passwordHash: _p, ...u }) => ({ ...u, password: passwords[u.correo] })),
  clientes: CLIENTES,
  proveedores: PROVEEDORES,
  ...h,
}
mkdirSync(destino.substring(0, destino.lastIndexOf('/')), { recursive: true })
writeFileSync(destino, JSON.stringify(datos))
console.log('seed exportado', destino, { ventas: h.ventas.length, dtes: h.dtes.length, kardex: h.kardex.length, turnos: h.turnos.length })
