# ==============================================================================
# RoadGuard AI — Production Dockerfile for Spring Boot + ONNX Runtime
# ==============================================================================
# NOTE: Uses Ubuntu/Debian-based glibc runtime (eclipse-temurin:21-jre-jammy)
# because Microsoft ONNX Runtime Java native libraries (libonnxruntime4j_jni.so)
# require glibc and will fail on Alpine (musl libc).
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build stage
# ------------------------------------------------------------------------------
FROM eclipse-temurin:21-jdk-jammy AS builder

WORKDIR /build

# Copy Maven wrapper and POM first to leverage Docker layer caching for dependencies
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B

# Copy source code and package application
COPY src ./src
RUN ./mvnw clean package -DskipTests -B

# ------------------------------------------------------------------------------
# Stage 2: Runtime stage
# ------------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-jammy

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create directories for models and persistent evidence uploads
RUN mkdir -p /app/models /app/uploads/evidence

# Copy built Spring Boot fat JAR from builder
COPY --from=builder /build/target/*.jar /app/app.jar

# Copy ONNX model weights
COPY models/ /app/models/

# Default Environment Variables (overridable at container launch)
ENV PORT=8080 \
    ROADGUARD_MODEL_PATH=/app/models/road_damage_yolo.onnx \
    ROADGUARD_UPLOAD_DIR=/app/uploads/evidence \
    SPRING_FLYWAY_ENABLED=true \
    H2_CONSOLE_ENABLED=false

# Expose default port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/api/v1/health || exit 1

# Start Spring Boot application with dynamic PORT binding and JVM reflection opens
ENTRYPOINT ["sh", "-c", "java --add-opens=java.base/java.lang=ALL-UNNAMED -Dserver.port=${PORT:-8080} -jar /app/app.jar"]
