# ==============================================================================
# Production Hardened Dockerfile for smdp-plus (Java 25 JRE Alpine)
# Microservice artifact pre-compiled via native host Maven build
# ==============================================================================
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app

# Non-root application user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy pre-compiled target artifact
COPY smdp-plus/target/*.jar /app/app.jar

# Enforce secure ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8092

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-XX:+UseG1GC", "-Djava.io.tmpdir=/tmp", "-jar", "/app/app.jar"]
