# DAASH ERP & DTE — Frontend

Frontend del sistema de facturación electrónica de **Adventure Works El Salvador**, desarrollado por **Daash Devs** (Práctica Profesional II · UCA).

Aplicación React + TypeScript que consume la API REST del backend Spring Boot (`../daash-backend`) con datos en PostgreSQL. Consulta el README de la raíz del repositorio para levantar el sistema completo.

## Ejecutar

```bash
npm install
npm run dev        # http://localhost:5173 (requiere el backend en http://localhost:8080)
npm run build      # genera dist/ para publicar
npm test           # pruebas unitarias
npm run test:e2e   # pruebas extremo a extremo (con npm run dev en ejecución)
```

## Usuarios de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Gerente | gerente@adventureworks.com.sv | Gerente123* |
| Cajero / Vendedor | cajero@adventureworks.com.sv | Cajero123* |
| Administrador de bodega | bodega@adventureworks.com.sv | Bodega123* |
| Auditor / Contador | auditor@adventureworks.com.sv | Auditor123* |

## Módulos (RF-01 a RF-20)

| Módulo | Qué incluye |
|---|---|
| Autenticación | Login con JWT HS256, bloqueo de 15 min tras 5 intentos fallidos, recuperación de contraseña con enlace de 15 min (bandeja de correo simulada) |
| Usuarios y roles | CRUD con baja lógica (soft delete), roles personalizados con permisos CRUD por módulo |
| Punto de venta | Escaneo/búsqueda, IVA 13 %, bloqueo sin stock, descuento con autorización de gerente, Factura o CCF |
| Caja | Apertura con fondo inicial, arqueo por denominación, corte Z con ticket PDF |
| DTE | JSON (fe-fc-v1, fe-ccf-v3, fe-nc-v3), firma JWS, sello de recepción, PDF con QR, envío por correo, notas de crédito, invalidación |
| Contingencia | Simulación de caída del MH, emisión diferida, cron de reintentos (5 min o 20 s en modo demo), evento de contingencia |
| Inventario | Productos, Kardex, ajustes con justificación obligatoria, alertas de reorden |
| Compras y proveedores | Ingreso de compras al Kardex, costo promedio ponderado, validación de NIT/NRC |
| Clientes | Validación de DUI (dígito verificador), NIT y NRC |
| Reportes | Dashboard, libros de IVA (consumidor, contribuyente, compras) e inventario en CSV para Excel |
| Auditoría | Bitácora de eventos de seguridad y operación |

## Demostración sugerida

1. Ingresa como **Cajero** → Punto de venta → abre el turno → vende → descarga el PDF y el JSON.
2. Ingresa como **Gerente** → Contingencia → *Simular caída del MH* → haz otra venta → *Restablecer servicio* y observa la transmisión automática.
3. Documentos DTE → abre un CCF → emite una **Nota de crédito** o **Invalida** el documento.
4. Configuración → *Restablecer datos de demostración* para empezar de cero.

> Proyecto académico: la firma y el sello de recepción provienen de un simulador del servicio del Ministerio de Hacienda implementado en el backend.
