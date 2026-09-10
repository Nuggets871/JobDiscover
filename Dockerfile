# ---- Stage 1 : build backend ----
FROM node:22-slim AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# ---- Stage 2 : build frontend ----
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 3 : runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/scripts ./scripts
COPY --from=backend-build /app/backend/migrations ./migrations
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node dist/index.js"]