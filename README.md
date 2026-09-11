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

`make frontend` et `make backend` permettent aussi de lancer les deux services
séparément. `make help` affiche toutes les commandes.

Pour repartir d'une base locale entièrement vide :

```sh
make db-reset       # destructif : efface toutes les données PostgreSQL locales
make seed           # crée/réinitialise le compte local ggez / ggez
```

Ouvre http://localhost:5173. PostgreSQL, les comptes et les identifiants France Travail doivent être configurés pour afficher les annonces.

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

- **Comptes** : e-mail + mot de passe (PBKDF2, 600 000 itérations) et cookie de session HttpOnly (durée réglable via `SESSION_DAYS`).
- **Offres réelles** : France Travail (clé partenaire) via `FRANCE_TRAVAIL_CLIENT_ID` / `_SECRET`. Les recherches sont mises en cache 15 min.
- **Cache** : recherches France Travail conservées 15 minutes en mémoire et dans PostgreSQL, détails 5 minutes en mémoire, référentiel complet des codes postaux et communes 7 jours en mémoire, géolocalisations 24 heures. Les requêtes simultanées identiques sont regroupées.
- **Recommandations** : préférences du profil + réactions (j'aime / peut-être / pas pour moi), avec une part de découverte réglable.
- **Enrichissement DeepSeek (optionnel)** : seulement si `AI_PUBLIC_JOB_ENRICHMENT=true` ; seuls des extraits d'annonces publiques sans contacts sont transmis.

## Déploiement

Voir [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
