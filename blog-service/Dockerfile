# ==============================================================================
# Production Hardened Dockerfile for blog-service (Java 25 JRE Alpine)
# Microservice artifact pre-compiled via native host Maven build
# ==============================================================================
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app

# Non-root application user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy pre-compiled target artifact
COPY blog-service/target/*.jar /app/app.jar

# Enforce secure ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8094

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-XX:+UseG1GC", "-Djava.io.tmpdir=/tmp", "-jar", "/app/app.jar"]
