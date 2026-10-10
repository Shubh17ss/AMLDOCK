# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /app

# Cache dependency layer — only re-downloaded when pom.xml changes
COPY pom.xml .
RUN mvn dependency:go-offline -q

COPY src ./src
RUN mvn clean package -DskipTests -q

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Non-root user
RUN addgroup -S spring && adduser -S spring -G spring
USER spring

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080 8081

# Container-aware heap: 75% of the task/container memory limit, so the same image fits a 512 MB
# Render box or a 2 GB Fargate task without a rebuild. JAVA_OPTS adds flags at run time (e.g. a
# JFR recording during a load test: -XX:StartFlightRecording=duration=10m,filename=/tmp/app.jfr).
ENV JAVA_OPTS=""
ENTRYPOINT ["sh", "-c", "exec java -XX:MaxRAMPercentage=75.0 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError $JAVA_OPTS -jar app.jar"]
