# ==============================================================================
# Multi-Stage Build Dockerfile for eim-service (Java 25 Spring Boot)
# ==============================================================================

# Stage 1: Build Jar Artifact using Maven
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder
WORKDIR /workspace

# Copy parent and module pom.xml files for dependency layer caching
COPY pom.xml .
COPY smdp-plus/pom.xml smdp-plus/
COPY device-simulator/pom.xml device-simulator/
COPY blog-service/pom.xml blog-service/
COPY monitor-service/pom.xml monitor-service/
COPY eim-service/pom.xml eim-service/

RUN mvn dependency:go-offline -B --fail-never

# Copy source code and build eim-service module
COPY eim-service eim-service
RUN mvn clean package -pl eim-service -am -DskipTests

# Stage 2: Hardened High-Performance JRE 25 Runtime
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app

# Non-root user creation
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy compiled jar
COPY --from=builder /workspace/eim-service/target/*.jar /app/app.jar

# Set file ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8096

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-XX:+UseG1GC", "-Djava.io.tmpdir=/tmp", "-jar", "/app/app.jar"]
