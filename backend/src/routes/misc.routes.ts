import { Router } from 'express';
import { remote, requireOK } from '../services/http.ts';
import { AppError } from '../validation.ts';
import { requireAuth, type AuthUser } from '../services/auth.ts';
import { h } from '../handler.ts';
import { MemoryCache } from '../services/memory-cache.ts';

export const miscRouter = Router();
type Commune = {
  nom: string;
  code: string;
  centre: { coordinates: [number, number] };
  codesPostaux?: string[];
};
type CommuneChoice = Commune & { codePostal?: string };
type CommuneResult = { communes: CommuneChoice[]; total: number };
const postalDirectory = new MemoryCache<CommuneChoice[]>(
  7 * 24 * 60 * 60_000,
  1,
);
const coordinateMemory = new MemoryCache<CommuneResult>(24 * 60 * 60_000, 100);

async function allPostalChoices() {
  return postalDirectory.getOrLoad('france', async () => {
    const response = await remote(
      'https://geo.api.gouv.fr/communes?fields=nom,code,centre,codesPostaux&format=json',
    );
    await requireOK(response);
    return ((await response.json()) as Commune[])
      .flatMap((commune) =>
        (commune.codesPostaux || []).map((codePostal) => ({
          ...commune,
          codePostal,
        })),
      )
      .sort(
        (a, b) =>
          (a.codePostal || '').localeCompare(b.codePostal || '') ||
          a.nom.localeCompare(b.nom, 'fr'),
      );
  });
}

miscRouter.get('/health', (_req, res) => res.send('ok'));

miscRouter.get(
  '/me',
  requireAuth,
  h(async (req, res) => {
    const user = (req as typeof req & { user: AuthUser }).user;
    res.json({ email: user.email });
  }),
);

miscRouter.get(
  '/status',
  h(async (_req, res) => {
    res.json({
      accounts: Boolean(process.env.DATABASE_URL),
      offers: Boolean(
        process.env.FRANCE_TRAVAIL_CLIENT_ID &&
        process.env.FRANCE_TRAVAIL_CLIENT_SECRET,
      ),
      ai: Boolean(process.env.DEEPSEEK_API_KEY),
    });
  }),
);

miscRouter.get(
  '/communes',
  h(async (req, res) => {
    const postal = String(req.query.postal || '').trim();
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const byPostal = /^[0-9]{1,5}$/.test(postal);
    const byCoordinates =
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180;
    if (!byPostal && !byCoordinates)
      throw new AppError(400, 'Indique un code postal ou une position valide.');

    if (byPostal) {
      const choices = (await allPostalChoices()).filter((commune) =>
        commune.codePostal?.startsWith(postal),
      );
      res.json({ communes: choices.slice(0, 50), total: choices.length });
      return;
    }

    const search = `lat=${lat}&lon=${lon}`;
    const result = await coordinateMemory.getOrLoad(search, async () => {
      const r = await remote(
        `https://geo.api.gouv.fr/communes?${search}&fields=nom,code,centre,codesPostaux&format=json`,
      );
      await requireOK(r);
      const communes = (await r.json()) as Commune[];
      return { communes, total: communes.length };
    });
    res.json(result);
  }),
);
