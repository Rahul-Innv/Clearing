# Clearing — server mode on any container host (Render, Railway, Fly, a VPS).
# Node >= 22.13 is required for the built-in node:sqlite store.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100
COPY --from=build /app ./
RUN mkdir -p .data
EXPOSE 3100
# Hosts inject PORT; the SQLite file lives on the container disk (fine for a demo).
CMD ["sh", "-c", "npx next start --port ${PORT:-3100}"]
