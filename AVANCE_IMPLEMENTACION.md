# Avance — DAASH ERP & DTE en 3 capas

Objetivo: React (daash-erp) + Spring Boot 3 / Java 21 (daash-backend) + PostgreSQL 16, con seguridad usuario/contraseña (BCrypt + JWT), y documentos actualizados con resultados reales.

## Decisiones
- Backend: Spring Boot 3.5, Spring Security (JWT HS256 stateless), Spring Data JPA/Hibernate, Flyway, PostgreSQL 16. Puerto 8080, prefijo /api.
- BD: esquema de `daash-erp/database/01_esquema.sql` adaptado como migraciones Flyway V1 (esquema) y V2 (roles). La app conecta como `daash_app` (mínimo privilegio); Flyway y el reinicio demo usan el dueño (`postgres`).
- Datos demo: exportados desde el seed del frontend (`daash-erp/scripts/exportar-seed.ts`) a `daash-backend/src/main/resources/seed/demo.json`; el backend los carga si la BD está vacía y desplaza las fechas al día actual.
- Lógica fiscal (IVA, JSON DTE, firma, simulador MH, contingencia con @Scheduled) vive en el backend; el frontend solo previsualiza totales y genera el PDF desde el JSON devuelto.
- Frontend: el store de zustand pasa a ser caché de la API (sin localStorage); token en sessionStorage.

## Fases
- [x] 1. Backend base: proyecto, Flyway, entidades, seguridad (login, JWT, bloqueo, recuperación), seed. Pruebas.
- [x] 2. API de todos los módulos + DTE + contingencia. Pruebas JUnit/Testcontainers.
- [x] 3. Frontend conectado a la API. Pruebas E2E.
- [x] 4. Pruebas finales (JUnit, E2E full stack, BD) + docker-compose.
- [x] 5. Documentos y presentaciones actualizados.

## Registro
- F1 OK (2026-11-20): Flyway V1+V2, seed demo, login JWT, bloqueo 5 intentos, recuperación, BCrypt, conexión como daash_app. BD en Docker puerto 5442 (5432 suele estar ocupado por otras instancias locales).
- Defecto real encontrado por la BD: códigos de barras duplicados en el seed (HL-U509 / HL-U509-R) → UNIQUE los rechazó; corregido en daash-erp/src/lib/seed.ts.
- F2 OK: API REST completa (auth, usuarios, roles, productos, kardex, clientes, proveedores, compras, turnos, ventas, dtes, contingencia + @Scheduled, correos, bitácora, config, reinicio demo). JUnit 26/26 (18 unitarias + 8 integración Testcontainers). Recorrido HTTP `daash-backend/pruebas/recorrido_api.py` 34/34.
  - Corridas: JUnit 1ª 25/26 (dígito verificador mal calculado en la prueba: 04512378-8). Recorrido 1ª 33/34 (URL sin codificar en la prueba → reemplazada por SQLi en login), 2ª 33/34 (SKU repetido entre corridas → SKU único).
- F3 OK: store de zustand reescrito como caché de la API (src/lib/api.ts + store.ts), proxy Vite /api → 8080, bandeja de correo demo (/api/auth/bandeja-demo, solo modo demo). E2E 21/21 (reinicia la BD al iniciar).
  - Corridas E2E: 1ª 20/21 (E2E-20 contaba los 401 esperados que Chrome registra como "Failed to load resource" → criterio: errores JS reales + respuestas 5xx). 2ª 21/21.
- F4 OK: Dockerfiles (backend Maven→JRE 21 usuario no root; frontend Vite→Nginx con proxy /api), docker compose (db 5442, backend 8080, frontend 8088). Resultados finales en evidencias/: JUnit 26/26, Vitest 24/24, recorrido API 34/34 (vía Nginx), concurrencia PASA (20 solicitudes, stock 5 → 5 aceptadas, 15 rechazadas, stock final 0; mediana 4.9 s por serialización: transmisión MH dentro de la transacción), E2E 21/21, BD 18/18 sobre el esquema Flyway (602,800 DTE, 438 MB, Q1 10.91→1.58 ms, Q3 20.32→0.41, Q4 22.81→0.05, Q6 9.81→3.94, Q7 24.22→0.07, respaldo 2.3 s 47.8 MB, restauración 2.4 s verificada).
  - Recorrido API vía Nginx 1ª 33/34: API-04 dependía del turno que dejó abierto E2E-18 (servidor respondió bien "La venta no tiene productos") → la prueba cierra turnos previos. Reproducido y corregido.
- F5 OK: 4 documentos Word y 2 presentaciones actualizados con la arquitectura de 3 capas y los resultados finales (124/124 casos). Copias PDF en entregables/PDF. Generadores en herramientas/generador-documentos.
