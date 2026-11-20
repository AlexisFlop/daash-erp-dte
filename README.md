# DAASH ERP & DTE

Sistema de punto de venta, inventario y facturación electrónica (DTE) para **Adventure Works El Salvador**, desarrollado por **Daash Devs** (Práctica Profesional II · UCA).

## Arquitectura

| Capa | Tecnología | Carpeta |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind, servido por Nginx | `daash-erp/` |
| Backend | Spring Boot 3.5 (Java 21): API REST, Spring Security (BCrypt + JWT), Spring Data JPA, Flyway | `daash-backend/` |
| Base de datos | PostgreSQL 16: dominios fiscales, particiones anuales de DTE, roles de mínimo privilegio, auditoría | migraciones en `daash-backend/src/main/resources/db/migration` |

La lógica fiscal vive en el backend: cálculo de IVA, generación del JSON del DTE según la guía v1.4, firma, simulador del servicio de recepción del Ministerio de Hacienda y un proceso programado de contingencia que reintenta cada 5 minutos (20 s en modo demo).

## Desplegar en Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/AlexisFlop/daash-erp-dte)

El archivo `render.yaml` crea una base de datos PostgreSQL 16 y un servicio web (imagen del `Dockerfile` de la raíz) que publica la API y el frontend desde el mismo dominio. Las claves (JWT y contraseñas) se generan automáticamente en Render.

> En el plan gratuito el servicio se suspende tras unos minutos sin uso: la primera visita puede tardar cerca de un minuto en responder.

## Ejecutar todo con Docker

```bash
docker compose up -d --build
```

- Aplicación: http://localhost:8088
- API: http://localhost:8080/api
- PostgreSQL: `localhost:5442` (base `daash`, usuario `postgres` / `demo`; la aplicación se conecta como `daash_app`)

## Desarrollo

```bash
docker compose up -d db                       # solo PostgreSQL
cd daash-backend && DB_URL="jdbc:postgresql://localhost:5442/daash?currentSchema=daash" mvn spring-boot:run
cd daash-erp && npm install && npm run dev    # http://localhost:5173 (proxy /api → 8080)
```

## Usuarios de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Gerente | gerente@adventureworks.com.sv | Gerente123* |
| Cajero / Vendedor | cajero@adventureworks.com.sv | Cajero123* |
| Administrador de bodega | bodega@adventureworks.com.sv | Bodega123* |
| Auditor / Contador | auditor@adventureworks.com.sv | Auditor123* |

## Pruebas

| Suite | Comando | Casos |
|---|---|---|
| Backend: unitarias + integración (Testcontainers) | `cd daash-backend && mvn test` | 26 |
| Frontend: unitarias | `cd daash-erp && npm test` | 24 |
| Recorrido de negocio por HTTP | `python3 daash-backend/pruebas/recorrido_api.py http://localhost:8080/api` | 34 |
| Concurrencia (sobreventa) | `python3 daash-backend/pruebas/concurrencia.py http://localhost:8080/api 20 5` | 1 |
| Extremo a extremo en navegador | `cd daash-erp && npm run dev` y luego `npm run test:e2e` | 21 |
| Base de datos (integridad, rendimiento, respaldo) | `python3 daash-erp/database/ejecutar_pruebas.py` | 18 |

La evidencia de la última ejecución está en `evidencias/`.
