.PHONY: help install db db-stop db-reset migrate dev backend frontend check test-integration build clean

help:
	@echo "make install          Installe le frontend et le backend"
	@echo "make dev              Lance frontend + backend"
	@echo "make frontend         Lance seulement Vite (:5173)"
	@echo "make backend          Lance seulement Express (:3100)"
	@echo "make db               Lance PostgreSQL local"
	@echo "make db-reset         EFFACE et recrée la base locale"
	@echo "make check            Typecheck, tests et builds"

install:
	cd backend && npm ci
	cd frontend && npm ci

db:
	docker compose up -d --wait

migrate:
	cd backend && npm run db:migrate

db-stop:
	docker compose down

db-reset:
	docker compose up -d --wait
	cd backend && DATABASE_URL=postgresql://jobdiscover:local-development-only@127.0.0.1:54329/jobdiscover DATABASE_SSL=false ALLOW_DATABASE_RESET=true npm run db:reset

dev:
	(cd backend && npm run dev) & (cd frontend && npm run dev) & wait

backend:
	cd backend && npm run dev

frontend:
	cd frontend && npm run dev

check:
	cd backend && npm run check
	cd frontend && npm run check

build:
	cd backend && npm run build
	cd frontend && npm run build

test-integration:
	cd backend && TEST_DATABASE_URL=postgresql://jobdiscover:local-development-only@127.0.0.1:54329/jobdiscover DATABASE_SSL=false npm run test:postgres

clean:
	rm -rf backend/dist frontend/dist
