# Compilación con Maven y ejecución con JRE 21
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S daash && adduser -S daash -G daash
COPY --from=build /app/target/daash-backend-1.0.0.jar app.jar
USER daash
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
