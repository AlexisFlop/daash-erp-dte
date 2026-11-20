# Imagen única para despliegue (Render u otro PaaS): el backend Spring Boot publica también el frontend compilado.
# 1) Frontend React
FROM node:24-alpine AS web
WORKDIR /web
COPY daash-erp/package.json daash-erp/package-lock.json ./
RUN npm ci --ignore-scripts
COPY daash-erp/ ./
RUN npx vite build

# 2) Backend Spring Boot con el frontend en classpath:/static
FROM maven:3.9-eclipse-temurin-21 AS api
WORKDIR /app
COPY daash-backend/pom.xml .
RUN mvn -q dependency:go-offline
COPY daash-backend/src ./src
COPY --from=web /web/dist ./src/main/resources/static
RUN mvn -q package -DskipTests

# 3) Ejecución con JRE 21 y usuario sin privilegios
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S daash && adduser -S daash -G daash
COPY --from=api /app/target/daash-backend-1.0.0.jar app.jar
USER daash
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
