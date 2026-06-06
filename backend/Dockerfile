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

EXPOSE 8080

# -Xmx380m keeps RSS under Render's 512 MB free-tier limit.
# MaxRAMPercentage is a fallback for environments that report more RAM.
ENTRYPOINT ["java", \
  "-Xmx380m", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]
