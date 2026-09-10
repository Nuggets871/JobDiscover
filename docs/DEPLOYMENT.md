# Déploiement

Architecture simple : le frontend (React/Vite) est un dossier statique, le backend (Express/Node 22) sert l'API. En production on sert les deux derrière un reverse proxy (Nginx, Caddy, Traefik).

## Prérequis

- Node 22+ sur le serveur
- PostgreSQL (rôle + base dédiés)
- Un domaine en HTTPS

## Étapes

1. **Base de données**

```sh
createdb jobdiscover
# créer un rôle dédié, ex. :
createuser -P jobdiscover
```

2. **Backend**

```sh
cd backend
npm ci
cp .env.example .env
# remplir DATABASE_URL, APP_ORIGIN, clés partenaires
npm run db:migrate
npm run build
npm start            # écoute sur le port 3100
```

Variables importantes :

- `DATABASE_URL` : chaîne PostgreSQL du rôle dédié.
- `DATABASE_SSL=false` : à ne désactiver qu'en local.
- `APP_ORIGIN` : origine publique du frontend (ex. `https://jobdiscover.example.fr`). Active le flag `Secure` sur le cookie de session en HTTPS.
- `SESSION_DAYS` : durée de session (défaut 30).
- `AUTH_EMAIL_MODE=smtp` : obligatoire en production.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` : envoi des liens de confirmation et de récupération.
- `FRANCE_TRAVAIL_CLIENT_ID` / `_SECRET` : activent les offres réelles.
- `DEEPSEEK_API_KEY` : enrichissement optionnel (reste désactivé tant que `AI_PUBLIC_JOB_ENRICHMENT` n'est pas `true`).
- `CRON_SECRET` : protège `POST /api/maintenance` (purge des caches expirés).

3. **Frontend**

```sh
cd frontend
npm ci
npm run build        # produit frontend/dist/
# servir dist/ par le reverse proxy, et proxifier /api vers 127.0.0.1:3100
```

En développement, Vite fait déjà ce proxy (`frontend/vite.config.ts`).

4. **Reverse proxy** : sert `frontend/dist/`, proxifie `/api` vers `127.0.0.1:3100`, HTTPS avec les en-têtes de sécurité usuels (`X-Content-Type-Options`, `Referrer-Policy`, etc.).

Le backend ajoute aussi les protections de base (`no-store`, `nosniff`, politique
de référent, permissions et contrôle d'origine). Le proxy doit ajouter HSTS en
HTTPS et une CSP adaptée aux fichiers Vite générés.

## Maintenance

`POST /api/maintenance` avec `Authorization: Bearer <CRON_SECRET>` purge les caches et sessions expirées. À programmer quotidiennement (cron).

Les recherches France Travail utilisent un cache mémoire de 15 minutes devant
le cache PostgreSQL persistant. Les détails d’annonces sont gardés 5 minutes,
le référentiel complet des codes postaux et communes 7 jours, et les recherches
par géolocalisation 24 heures en mémoire. Ces caches sont bornés pour éviter une
croissance continue du processus Node.

## Recommandations de sécurité

- Ne pas exposer PostgreSQL publiquement ; autoriser uniquement le serveur.
- Limiter les tentatives de connexion (le backend rate-limite déjà par adresse).
- Sauvegarder PostgreSQL régulièrement et tester une restauration.
- Ne jamais utiliser `AUTH_EMAIL_MODE=console` ni `make db-reset` en production.
