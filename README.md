# JobDiscover

Découverte mobile-first d'offres d'emploi en France. Une app React (Vite) + un backend Express (Node 22) + PostgreSQL.

## Structure

```
.
├── backend/               # API Express (Node 22 + PostgreSQL)
│   ├── src/               # config, routes, services, validation
│   ├── migrations/        # schéma SQL versionné
│   ├── scripts/migrate.mjs
│   └── tests/             # tests unitaires + intégration Postgres
├── frontend/              # App React (Vite)
│   └── src/
│       ├── components/    # discovery, auth, profil, ui
│       ├── lib/           # modèle, recommandations, api
│       └── pages/
├── docker-compose.yml     # PostgreSQL local
└── Makefile               # commandes utiles
```

## Démarrage en local

Prérequis : Node 22.13+, Docker (ou un PostgreSQL local), `make`.

```sh
make install        # npm install backend + frontend
make db             # docker compose up -d --wait (Postgres)
cp backend/.env.example backend/.env
make migrate        # applique les migrations
make dev            # backend (:3100) + frontend (:5173)
```

Ouvre http://localhost:5173. Sans base configurée, l'app fonctionne en mode démo (offres fictives, rien n'est enregistré).

## Vérifications

```sh
make check          # typecheck + tests + build backend et frontend
```

Le test d'intégration Postgres s'exécute avec `TEST_DATABASE_URL` :

```sh
cd backend
TEST_DATABASE_URL=postgresql://jobdiscover:local-development-only@127.0.0.1:5432/jobdiscover npm run test:postgres
```

## Fonctionnement

- **Démo** : offres fictives en mémoire, aucune donnée persistée.
- **Comptes** : email + mot de passe (PBKDF2, 600 000 itérations), un cookie de session HttpOnly de 30 jours. Aucun e-mail n'est envoyé.
- **Offres réelles** : France Travail (clé partenaire) via `FRANCE_TRAVAIL_CLIENT_ID` / `_SECRET`. Les recherches sont mises en cache 15 min.
- **Recommandations** : préférences du profil + réactions (j'aime / peut-être / pas pour moi), avec une part de découverte réglable.
- **Enrichissement DeepSeek (optionnel)** : seulement si `AI_PUBLIC_JOB_ENRICHMENT=true` ; seuls des extraits d'annonces publiques sans contacts sont transmis.

## Déploiement

Voir [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).