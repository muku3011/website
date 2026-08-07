# ==============================================================================
# Production Hardened Dockerfile for device-simulator (LPA Simulator - Java 25 JRE)
# Microservice artifact pre-compiled via native host Maven build
# ==============================================================================
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app

# Non-root application user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy pre-compiled target artifact
COPY device-simulator/target/*.jar /app/app.jar

# Enforce secure ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8093

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-XX:+UseG1GC", "-Djava.io.tmpdir=/tmp", "-jar", "/app/app.jar"]
