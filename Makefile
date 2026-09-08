.PHONY: install db migrate dev server web check build

install:
	cd backend && npm install
	cd frontend && npm install

db:
	docker compose up -d --wait

migrate:
	cd backend && npm run db:migrate

dev:
	(cd backend && npm run dev) & (cd frontend && npm run dev) & wait

server:
	cd backend && npm run dev

web:
	cd frontend && npm run dev

check:
	cd backend && npm run check
	cd frontend && npm run check

build:
	cd backend && npm run build
	cd frontend && npm run build