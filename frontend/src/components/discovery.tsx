import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Compass,
  Heart,
  MapPin,
  SlidersHorizontal,
  UserRound,
  X,
  Bookmark,
  MoveUpRight,
  RotateCcw,
  ArrowRight,
  BriefcaseBusiness,
  LogOut,
  ShieldCheck,
  Download,
  Trash2,
  LoaderCircle,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  defaultProfile,
  kindLabels,
  rejectionReasons,
  type Job,
  type Profile,
  type Reaction,
} from '@/lib/model';
import { recommend, metierKey } from '@/lib/recommendations';
import { api, ApiError } from '@/lib/api';
import { safeExternalUrl } from '@/lib/validation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { AuthPanel } from './auth-panel';
import { ProfileEditor } from './profile-editor';
import { EnginePanel } from './engine-panel';
type Panel =
  | 'auth'
  | 'profile'
  | 'detail'
  | 'reason'
  | 'search'
  | 'engine'
  | 'account'
  | null;
export default function Discovery() {
  const [tab, setTab] = useState('discover');
  const [panel, setPanel] = useState<Panel>(null);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [status, setStatus] = useState({
    accounts: false,
    offers: false,
    ai: false,
  });
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [feedback, setFeedback] = useState<Reaction[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [surprise, setSurprise] = useState(false);
  const [detail, setDetail] = useState<Job | null>(null);
  const [history, setHistory] = useState<
    { reaction: Reaction; previous?: Reaction }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [partial, setPartial] = useState(false);
  const [savedFilter, setSavedFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const pending = useRef(false);
  const last = history.length ? history[history.length - 1] : null;
  const cards = recommend(jobs, profile, feedback, {
    surprise,
    skipped,
    offset: feedback.length + skipped.length,
  });
  const current = cards[0];
  const saved = feedback.filter(
    (f) =>
      f.verdict !== 'reject' &&
      (savedFilter === 'all' || f.verdict === savedFilter),
  );
  const excludedMetiers = useMemo(() => {
    const byKey = new Map<string, Reaction>();
    for (const f of feedback) {
      if (f.verdict !== 'reject' || f.reason !== 'missions') continue;
      const key = metierKey(f.job);
      if (key && !byKey.has(key)) byKey.set(key, f);
    }
    return [...byKey.values()];
  }, [feedback]);
  async function loadOffers(
    p: Profile,
    opts: { q?: string; cursor?: number; append?: boolean } = {},
  ) {
    const q = opts.q ?? query;
    const cursor = opts.cursor ?? 0;
    const append = opts.append ?? false;
    setSourceError('');
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      if (!p.completed) {
        setJobs([]);
        setNextCursor(null);
        return;
      }
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (cursor) params.set('cursor', String(cursor));
      const suffix = params.toString();
      const r = await api<{
        jobs: Job[];
        partial: boolean;
        nextCursor: number | null;
      }>(`offers${suffix ? `?${suffix}` : ''}`);
      setJobs((prev) =>
        append
          ? [
              ...prev,
              ...r.jobs.filter((job) => !prev.some((x) => x.id === job.id)),
            ]
          : r.jobs,
      );
      setNextCursor(r.nextCursor);
      setPartial(r.partial);
      if (!append) setSkipped([]);
    } catch (e) {
      if (!append) setJobs([]);
      setSourceError((e as Error).message);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }
  async function runSearch(e: FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    setQuery(q);
    setSkipped([]);
    setPanel(null);
    await loadOffers(profile, { q, cursor: 0 });
  }
  function clearSearch() {
    setSearchInput('');
    setQuery('');
    setSkipped([]);
    setPanel(null);
    void loadOffers(profile, { q: '', cursor: 0 });
  }
  async function loadAccount() {
    const who = await api<{ email: string }>('me');
    const [p, f] = await Promise.all([
      api<Profile>('profile'),
      api<Reaction[]>('feedback'),
    ]);
    setUser(who);
    setProfile(p);
    setFeedback(f);
    setJobs([]);
    setSkipped([]);
    setHistory([]);
    setQuery('');
    setSearchInput('');
    setNextCursor(null);
    setPanel(p.completed ? null : 'profile');
    await loadOffers(p);
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const s = await api<typeof status>('status');
        if (!active) return;
        setStatus(s);
        if (s.accounts) {
          try {
            await loadAccount();
          } catch (e) {
            if (!(e instanceof ApiError) || e.status !== 401)
              setError((e as Error).message);
          }
        }
      } catch {
        if (active)
          setError(
            'Impossible de vérifier la disponibilité du service. Réessaie dans quelques instants.',
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (loading || loadingMore || nextCursor === null || cards.length > 0)
      return;
    void loadOffers(profile, { q: query, cursor: nextCursor, append: true });
  }, [cards.length, loading, loadingMore, nextCursor, query]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);
  async function saveProfile(p: Profile) {
    await api('profile', 'PUT', p);
    setProfile(p);
    setPanel(null);
    setSkipped([]);
    setNotice('Tes préférences sont enregistrées.');
    await loadOffers(p, { q: query, cursor: 0 });
  }
  async function saveWeights(p: Profile) {
    await api('profile', 'PUT', p);
    setProfile(p);
    setNotice('Tes réglages du moteur sont enregistrés.');
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = new FormData(e.currentTarget as HTMLFormElement);
      await api('auth/password', 'POST', {
        password: data.get('password'),
      });
      resetSession();
      setNotice(
        'Ton mot de passe a été changé. Connecte-toi avec ton nouveau mot de passe.',
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function react(
    verdict: Reaction['verdict'],
    job = current?.job,
    reason: string | null = null,
    askReason = true,
  ) {
    if (!job || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const previous = feedback.find((f) => f.job_id === job.id);
      const reaction: Reaction = {
        job_id: job.id,
        job,
        verdict,
        reason,
        created_at: new Date().toISOString(),
      };
      await api('feedback', 'POST', { job_id: job.id, verdict, reason });
      setFeedback((f) => [reaction, ...f.filter((x) => x.job_id !== job.id)]);
      setHistory((h) => {
        const top = h[h.length - 1];
        const sameJob = top?.reaction.job_id === job.id;
        const previousKept = !askReason && sameJob ? top!.previous : previous;
        const entry = { reaction, previous: previousKept };
        const rest = sameJob ? h.slice(0, -1) : h;
        return [...rest, entry].slice(-50);
      });
      setNotice(
        verdict === 'reject'
          ? 'Offre écartée. Tu peux annuler ce choix.'
          : verdict === 'like'
            ? 'Une piste de plus dans tes favoris.'
            : 'Gardée de côté pour y revenir.',
      );
      if (verdict === 'reject' && askReason) setPanel('reason');
      else if (panel === 'detail') setPanel(null);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function undo() {
    const entry = history[history.length - 1];
    if (!entry || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (entry.previous) await api('feedback', 'POST', entry.previous);
      else
        await api(
          `feedback?id=${encodeURIComponent(entry.reaction.job_id)}`,
          'DELETE',
        );
      setFeedback((f) => [
        ...(entry.previous ? [entry.previous] : []),
        ...f.filter((x) => x.job_id !== entry.reaction.job_id),
      ]);
      setSkipped((s) => s.filter((id) => id !== entry.reaction.job_id));
      setHistory((h) => h.slice(0, -1));
      setNotice('Action annulée.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }
  async function removeSaved(f: Reaction) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await api(`feedback?id=${encodeURIComponent(f.job_id)}`, 'DELETE');
      setFeedback((all) => all.filter((x) => x.job_id !== f.job_id));
      setNotice('Offre retirée des favoris. Elle peut à nouveau apparaître.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function restoreMetier(f: Reaction) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await api(`feedback?id=${encodeURIComponent(f.job_id)}`, 'DELETE');
      setFeedback((all) => all.filter((x) => x.job_id !== f.job_id));
      setNotice('Ce métier peut à nouveau apparaître.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function showDetail(job: Job) {
    setDetail(job);
    setPanel('detail');
    setError('');
    setBusy(true);
    try {
      const fresh = await api<Job>(`offers/${encodeURIComponent(job.id)}`);
      setDetail(fresh);
      setJobs((all) => all.map((j) => (j.id === fresh.id ? fresh : j)));
      setFeedback((all) =>
        all.map((f) => (f.job_id === fresh.id ? { ...f, job: fresh } : f)),
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 410) {
        setDetail({ ...job, active: false });
        setFeedback((all) =>
          all.map((f) =>
            f.job_id === job.id
              ? { ...f, job: { ...f.job, active: false } }
              : f,
          ),
        );
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function surpriseNow() {
    if (current) setSkipped((s) => [...s, current.job.id]);
    setSurprise(true);
    setNotice('Place à une autre piste. Tes contraintes restent respectées.');
  }
  function resetSession() {
    setUser(null);
    setProfile(defaultProfile);
    setJobs([]);
    setFeedback([]);
    setSkipped([]);
    setHistory([]);
    setPanel(null);
    setTab('discover');
    setNotice('Tu es déconnecté.');
    setSourceError('');
    setQuery('');
    setSearchInput('');
    setNextCursor(null);
  }
  async function logout() {
    setBusy(true);
    try {
      await api('auth/logout', 'POST', {});
      resetSession();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportData() {
    setBusy(true);
    try {
      const data = await api('export');
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mes-donnees-jobdiscover.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Ton export a été téléchargé sur cet appareil.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteAccount() {
    setBusy(true);
    setDeleteError('');
    try {
      await api('auth/delete', 'POST', {
        confirmation: deleteText,
        password: deletePassword,
      });
      setDeleteOpen(false);
      resetSession();
      setNotice('Ton compte et tes données actives ont été supprimés.');
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <header className="masthead">
        <a className="wordmark" href="/">
          jobdiscover<span className="wordmark-dot">.</span>
        </a>
        <button
          className={user ? 'avatar' : 'account-button'}
          onClick={() => (user ? setTab('profile') : setPanel('auth'))}
          aria-label={user ? 'Mon profil' : 'Se connecter'}
        >
          {user ? (
            <UserRound size={19} />
          ) : (
            <>
              Mon espace <ArrowUpRight size={15} />
            </>
          )}
        </button>
      </header>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(String(v));
          setError('');
        }}
      >
        <TabsList className="main-nav" aria-label="Navigation principale">
          <TabsTrigger value="discover">
            <Compass />
            Découvrir
          </TabsTrigger>
          <TabsTrigger value="saved">
            <Heart />
            Favoris
            {feedback.filter((f) => f.verdict !== 'reject').length > 0 && (
              <span className="nav-count">
                {feedback.filter((f) => f.verdict !== 'reject').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="profile">
            <UserRound />
            Profil
          </TabsTrigger>
        </TabsList>
        <TabsContent value="discover">
          <div className="workspace">
            <section
              className="discovery-column"
              aria-label="Offres à découvrir"
            >
              <div className="filter-bar">
                <div className="filter-summary">
                  <button onClick={() => setPanel('profile')}>
                    <MapPin size={14} />
                    {profile.city || 'Choisir ma ville'} · {profile.radius} km
                  </button>
                  <button onClick={() => setPanel('profile')}>
                    {profile.contracts.length
                      ? profile.contracts.join(' · ')
                      : 'Tous les contrats'}
                  </button>
                  {query && (
                    <span className="filter-chip search-chip">
                      Recherche : {query}
                      <button
                        type="button"
                        onClick={clearSearch}
                        aria-label="Effacer la recherche"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {profile.noWeekend && <span>Sans week-end</span>}
                  {profile.noNight && <span>Sans nuit</span>}
                  {profile.domain && profile.domainPreference !== 'any' && (
                    <span>
                      {profile.domainPreference === 'avoid'
                        ? `Sans : ${profile.domain}`
                        : `Domaine : ${profile.domain}`}
                    </span>
                  )}
                </div>
                <button
                  className="icon-button"
                  onClick={() => setPanel('search')}
                  aria-label="Rechercher par métier ou mot-clé"
                >
                  <Search size={20} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => setPanel('profile')}
                  aria-label="Modifier mes filtres"
                >
                  <SlidersHorizontal size={20} />
                </button>
              </div>
              {sourceError ? (
                <div className="empty-state">
                  <Compass size={32} />
                  <h3>Une petite pause technique.</h3>
                  <p>{sourceError}</p>
                  <button
                    className="primary-button"
                    onClick={() => loadOffers(profile)}
                    disabled={loading}
                  >
                    Réessayer
                  </button>
                </div>
              ) : loading ? (
                <output className="empty-state">
                  <LoaderCircle className="spin" />
                  <h3>On cherche tes prochaines pistes…</h3>
                </output>
              ) : current ? (
                <>
                  <article
                    className={`job-card ${current.kind}`}
                    key={current.job.id}
                  >
                    <div className="job-body">
                      <span className="card-badge">
                        <Compass size={13} />
                        {kindLabels[current.kind]}
                      </span>
                      <div className="company-line">
                        <span className="company-monogram">
                          {current.job.company
                            .split(' ')
                            .slice(0, 2)
                            .map((x) => x[0])
                            .join('')}
                        </span>
                        <div>
                          <p>{current.job.company}</p>
                          <span>{current.job.sector}</span>
                        </div>
                        <button
                          className="bookmark-outline"
                          disabled={busy}
                          onClick={() => react('maybe')}
                          aria-label="Garder cette offre pour plus tard"
                        >
                          <Bookmark size={21} />
                        </button>
                      </div>
                      <h3>{current.job.title}</h3>
                      <p className="location">
                        <MapPin size={15} />
                        {current.job.city}
                        <span>•</span>
                        {current.job.contract === 'MIS'
                          ? 'Intérim'
                          : current.job.contract}
                      </p>
                      <p className="job-summary">{current.job.summary}</p>
                      <div className="salary">
                        <BriefcaseBusiness size={16} />
                        {current.job.salary}
                      </div>
                      <div className="why">
                        <span className="why-icon">
                          <MoveUpRight size={19} />
                        </span>
                        <div>
                          <strong>
                            {current.kind === 'match'
                              ? 'Pourquoi cette piste ?'
                              : current.kind === 'neighbor'
                                ? 'Un autre chemin possible.'
                                : 'Et si tu explorais cette piste ?'}
                          </strong>
                          <p>{current.explanation}</p>
                        </div>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => showDetail(current.job)}
                      >
                        Découvrir les missions <ArrowUpRight size={18} />
                      </button>
                    </div>
                    <div className="reaction-bar">
                      <button
                        disabled={busy}
                        onClick={() => react('reject')}
                        className="reaction reject"
                      >
                        <span>
                          <X />
                        </span>
                        Pas pour moi
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => react('maybe')}
                        className="reaction maybe"
                      >
                        <span>
                          <Bookmark />
                        </span>
                        Peut-être
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => react('like')}
                        className="reaction like"
                      >
                        <span>
                          <Heart />
                        </span>
                        Ça me plaît
                      </button>
                    </div>
                  </article>
                </>
              ) : loadingMore ? (
                <output className="empty-state">
                  <LoaderCircle className="spin" />
                  <h3>On charge d’autres offres…</h3>
                </output>
              ) : (
                <div className="empty-state">
                  <Compass size={34} />
                  <h3>
                    {!user
                      ? 'Connecte-toi pour découvrir les offres.'
                      : !profile.completed
                        ? 'On fait connaissance ?'
                        : 'Tu as exploré ces pistes.'}
                  </h3>
                  <p>
                    {!user
                      ? 'Tes préférences permettent de sélectionner des annonces France Travail qui correspondent à ta recherche.'
                      : !profile.completed
                        ? 'Quelques envies et une commune suffisent pour commencer.'
                        : 'Aucune autre offre ne correspond ici à tes critères. Tu peux revoir les offres passées, modifier tes filtres ou chercher un mot-clé.'}
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => setPanel(user ? 'profile' : 'auth')}
                  >
                    {user
                      ? 'Ajuster mes préférences'
                      : 'Se connecter ou créer un compte'}
                  </button>
                  {skipped.length > 0 && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setSkipped([]);
                        setSurprise(false);
                      }}
                    >
                      Revoir les offres passées
                    </button>
                  )}
                  {user && profile.completed && (
                    <button
                      className="text-button"
                      onClick={() =>
                        nextCursor
                          ? loadOffers(profile, {
                              q: query,
                              cursor: nextCursor,
                              append: true,
                            })
                          : loadOffers(profile, { q: query, cursor: 0 })
                      }
                    >
                      {nextCursor
                        ? 'Voir la suite des offres'
                        : 'Relancer la recherche'}
                    </button>
                  )}
                </div>
              )}
              <div className="below-actions">
                <button disabled={!last || busy} onClick={undo}>
                  <RotateCcw size={14} />
                  Annuler
                </button>
                {current && (
                  <button
                    onClick={() => {
                      setSkipped((s) => [...s, current.job.id]);
                      setNotice(
                        'Offre passée, sans influencer tes préférences.',
                      );
                    }}
                  >
                    Passer sans avis <ArrowRight size={14} />
                  </button>
                )}
              </div>
              <button
                className="surprise-action text-button"
                onClick={surpriseNow}
                disabled={!current}
              >
                Surprends-moi <MoveUpRight size={16} />
              </button>
              {partial && (
                <p className="form-help">
                  D’autres offres existent dans cette zone : elles se chargent
                  au fil de ta progression.
                </p>
              )}
            </section>
          </div>
        </TabsContent>
        <TabsContent value="saved">
          <div className="simple-page favorites-page">
            <span className="eyebrow">À GARDER SOUS LA MAIN</span>
            <h1>Les pistes qui te parlent.</h1>
            <p>Une envie, une curiosité. Tu peux y revenir quand tu veux.</p>
            <Tabs
              value={savedFilter}
              onValueChange={(v) => setSavedFilter(String(v))}
            >
              <TabsList className="saved-tabs">
                <TabsTrigger value="all">Tout</TabsTrigger>
                <TabsTrigger value="like">Ça me plaît</TabsTrigger>
                <TabsTrigger value="maybe">Peut-être</TabsTrigger>
              </TabsList>
            </Tabs>
            {saved.length === 0 ? (
              <div className="empty-state">
                <Heart size={32} />
                <h3>La bonne piste viendra.</h3>
                <p>
                  Les offres qui te plaisent ou t’intriguent t’attendront ici.
                </p>
                <button
                  className="primary-button"
                  onClick={() => (user ? setTab('discover') : setPanel('auth'))}
                >
                  {user ? 'Découvrir des offres' : 'Se connecter'}{' '}
                  <ArrowRight size={17} />
                </button>
              </div>
            ) : (
              <div className="saved-list">
                {saved.map((f) => (
                  <article key={f.job_id} className="saved-card">
                    <div className="saved-top">
                      <span className="eyebrow">
                        {f.verdict === 'like' ? 'ÇA ME PLAÎT' : 'À EXPLORER'}
                      </span>
                      <button
                        className="icon-button"
                        onClick={() => removeSaved(f)}
                        disabled={busy}
                        aria-label={`Retirer ${f.job.title} des favoris`}
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <h2>
                      <button onClick={() => showDetail(f.job)}>
                        {f.job.title}
                      </button>
                    </h2>
                    <p>
                      {f.job.company} · {f.job.city}
                    </p>
                    <div className="saved-bottom">
                      <span>
                        {f.job.contract} · {f.job.salary}
                      </span>
                      <button
                        className="icon-button"
                        onClick={() => showDetail(f.job)}
                        aria-label={`Voir ${f.job.title}`}
                      >
                        <ArrowUpRight size={20} />
                      </button>
                    </div>
                    {!f.job.active && (
                      <p className="expired">
                        Cette annonce n’est plus disponible.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="profile">
          <div className="simple-page profile-page">
            <span className="eyebrow">MON ESPACE</span>
            <h1>Ton profil.</h1>
            {!user ? (
              <>
                <p>
                  Connecte-toi pour définir tes préférences et recevoir des
                  annonces correspondant à ta recherche.
                </p>
                <div className="profile-section">
                  <button
                    className="primary-button"
                    onClick={() => setPanel('auth')}
                  >
                    Créer mon espace <ArrowRight size={18} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="private-account">
                  <ShieldCheck size={17} />
                  Espace privé · {user.email}
                </p>
                <div className="settings-list">
                  <button
                    className="settings-row"
                    onClick={() => setPanel('profile')}
                  >
                    <span className="settings-icon">
                      <MapPin size={18} />
                    </span>
                    <span className="settings-text">
                      <strong>Ma recherche</strong>
                      <small>
                        {profile.city || 'Commune à compléter'} ·{' '}
                        {profile.radius} km
                        {profile.contracts.length
                          ? ` · ${profile.contracts.length} contrat${profile.contracts.length > 1 ? 's' : ''}`
                          : ''}
                        {profile.interests.length
                          ? ` · ${profile.interests.length} envie${profile.interests.length > 1 ? 's' : ''}`
                          : ''}
                      </small>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                  <button
                    className="settings-row"
                    onClick={() => setPanel('engine')}
                  >
                    <span className="settings-icon">
                      <SlidersHorizontal size={18} />
                    </span>
                    <span className="settings-text">
                      <strong>Moteur de recommandation</strong>
                      <small>
                        {excludedMetiers.length
                          ? `${excludedMetiers.length} métier${excludedMetiers.length > 1 ? 's' : ''} écarté${excludedMetiers.length > 1 ? 's' : ''}`
                          : 'Règle l’influence de chaque activité'}
                      </small>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                  <button
                    className="settings-row"
                    onClick={() => setPanel('account')}
                  >
                    <span className="settings-icon">
                      <ShieldCheck size={18} />
                    </span>
                    <span className="settings-text">
                      <strong>Compte & confidentialité</strong>
                      <small>Mot de passe, données, déconnexion</small>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
      {(error || notice) && (
        <div
          className={`feedback-notice ${error ? 'is-error' : 'is-notice'}`}
          role={error ? 'alert' : 'status'}
        >
          {error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{error || notice}</span>
          <button
            aria-label="Fermer le message"
            onClick={() => {
              setError('');
              setNotice('');
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <Sheet
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="app-sheet"
        >
          <SheetHeader className="sheet-header">
            <SheetTitle>
              {panel === 'auth'
                ? 'Mon espace'
                : panel === 'search'
                  ? 'Rechercher'
                  : panel === 'engine'
                    ? 'Moteur de recommandation'
                    : panel === 'account'
                      ? 'Compte & confidentialité'
                      : panel === 'profile'
                        ? profile.completed
                          ? 'Mes envies & mes filtres'
                          : 'Ton point de départ'
                        : panel === 'reason'
                          ? 'Ce qui te freine'
                          : 'Le détail de cette piste'}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {panel === 'reason'
                ? 'Un motif facultatif pour mieux comprendre ton choix.'
                : 'Tu peux fermer ce panneau pour revenir aux offres.'}
            </SheetDescription>
            <SheetClose className="icon-button" aria-label="Fermer le panneau">
              <X size={20} />
            </SheetClose>
          </SheetHeader>
          <div className="sheet-scroll">
            {panel === 'auth' && (
              <AuthPanel enabled={status.accounts} onSuccess={loadAccount} />
            )}{' '}
            {panel === 'search' && (
              <div className="search-panel">
                <span className="eyebrow">AFFINER TA RECHERCHE</span>
                <h2>Un métier, un mot-clé ?</h2>
                <p>
                  Restreins les annonces à celles qui correspondent à un métier
                  ou un thème précis.
                </p>
                <form onSubmit={runSearch} className="search-form">
                  <div className="search-field">
                    <Search size={16} />
                    <input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="Métier, mot-clé…"
                      aria-label="Rechercher par métier ou mot-clé"
                      maxLength={80}
                      autoFocus
                    />
                    {(searchInput || query) && (
                      <button
                        type="button"
                        className="search-clear"
                        aria-label="Effacer la saisie"
                        onClick={() => setSearchInput('')}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <button className="primary-button">
                    {query ? 'Actualiser la recherche' : 'Rechercher'}
                    <ArrowRight size={17} />
                  </button>
                  {query && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={clearSearch}
                    >
                      Effacer la recherche
                    </button>
                  )}
                </form>
                <p className="form-help">
                  Cette recherche s’ajoute à tes filtres (zone, contrats,
                  contraintes).
                </p>
              </div>
            )}{' '}
            {panel === 'profile' && user && (
              <ProfileEditor initial={profile} onSave={saveProfile} />
            )}{' '}
            {panel === 'engine' && user && (
              <div className="engine-page">
                <span className="eyebrow">TON MOTEUR</span>
                <h2>Ce que pense le moteur.</h2>
                <p>
                  Chaque activité pèse entre −3 et +3 dans le classement des
                  offres. Déplace un curseur pour ajuster, ou remets-le sur
                  automatique.
                </p>
                <EnginePanel
                  profile={profile}
                  feedback={feedback}
                  onSave={saveWeights}
                />
                {excludedMetiers.length > 0 && (
                  <div className="excluded-block">
                    <h3>Métiers écartés</h3>
                    <p>
                      Rejetés pour leurs missions : ils ne reviendront plus.
                      Touche la croix pour les réautoriser.
                    </p>
                    <ul className="metiers-list">
                      {excludedMetiers.map((f) => (
                        <li key={f.job_id}>
                          <span>
                            <strong>{f.job.title}</strong>
                            <small>{f.job.sector}</small>
                          </span>
                          <button
                            type="button"
                            className="icon-button"
                            disabled={busy}
                            onClick={() => restoreMetier(f)}
                            aria-label={`Réautoriser ${f.job.title}`}
                          >
                            <X size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}{' '}
            {panel === 'account' && user && (
              <div className="account-page">
                <span className="eyebrow">TON COMPTE</span>
                <h2>Compte & confidentialité.</h2>
                <p className="private-account">
                  <ShieldCheck size={17} /> {user.email}
                </p>
                <div className="account-block">
                  <h3>Mot de passe</h3>
                  <form className="password-form" onSubmit={changePassword}>
                    <input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                      aria-label="Nouveau mot de passe"
                      placeholder="Nouveau mot de passe"
                    />
                    <button className="primary-button" disabled={busy}>
                      {busy ? 'Enregistrement…' : 'Changer mon mot de passe'}
                    </button>
                  </form>
                </div>
                <div className="account-block">
                  <h3>Confidentialité</h3>
                  <p>
                    Tes coordonnées, tes préférences et tes réactions ne sont
                    pas envoyées à DeepSeek. Aucun autre membre ne peut
                    consulter ton profil.
                  </p>
                  <a className="text-button" href="/confidentialite">
                    Comprendre les données conservées <ArrowUpRight size={16} />
                  </a>
                </div>
                <div className="account-actions">
                  <button onClick={exportData} disabled={busy}>
                    <Download size={18} />
                    Exporter mes données
                  </button>
                  <button onClick={logout} disabled={busy}>
                    <LogOut size={18} />
                    Me déconnecter
                  </button>
                  <button
                    className="danger-link"
                    onClick={() => {
                      setDeleteText('');
                      setDeletePassword('');
                      setDeleteError('');
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 size={18} />
                    Supprimer mon compte
                  </button>
                </div>
              </div>
            )}{' '}
            {panel === 'reason' && last && (
              <div className="reason-panel">
                <span className="eyebrow">TON AVIS NOUS GUIDE</span>
                <h2>Qu’est-ce qui ne te plaît pas ?</h2>
                <p>
                  Un trajet trop long ne veut pas dire que le métier ne
                  t’intéresse pas.
                </p>
                <div className="reason-options">
                  {Object.entries(rejectionReasons).map(([key, label]) => (
                    <button
                      disabled={busy}
                      key={key}
                      onClick={async () => {
                        if (
                          await react('reject', last.reaction.job, key, false)
                        )
                          setPanel(null);
                      }}
                    >
                      {label}
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </div>
                <button className="text-button" onClick={() => setPanel(null)}>
                  Passer cette question <ArrowRight size={16} />
                </button>
              </div>
            )}
            {panel === 'detail' && detail && (
              <div className="detail-panel">
                <span className="eyebrow">FRANCE TRAVAIL & PARTENAIRES</span>
                <h2>{detail.title}</h2>
                <p>
                  {detail.company} · {detail.city}
                </p>
                <div className="detail-facts">
                  <span>{detail.contract}</span>
                  <span>{detail.salary}</span>
                </div>
                {busy && (
                  <output className="notice">Vérification de l’annonce…</output>
                )}
                {error && (
                  <p className="error-message" role="alert">
                    {error}
                  </p>
                )}
                {!detail.active && (
                  <p className="expired">
                    Cette annonce n’est plus disponible. Elle reste dans tes
                    favoris comme piste de métier.
                  </p>
                )}
                <h3>Les missions</h3>
                <p className="description">{detail.description}</p>
                <h3>À regarder de plus près</h3>
                <ul className="detail-checks">
                  <li>
                    {detail.experienceRequired
                      ? 'Expérience ou qualifications à vérifier dans l’annonce.'
                      : 'Offre ouverte aux débutants.'}
                  </li>
                  <li>
                    {detail.weekend === null
                      ? 'Travail le week-end : non précisé.'
                      : detail.weekend
                        ? 'Du travail le week-end est mentionné.'
                        : 'Travail en semaine indiqué.'}
                  </li>
                  <li>
                    {detail.night === null
                      ? 'Travail de nuit : non précisé.'
                      : detail.night
                        ? 'Du travail de nuit est mentionné.'
                        : 'Travail en journée indiqué.'}
                  </li>
                </ul>
                <p className="form-help">
                  Actualisation de l’annonce :{' '}
                  {new Intl.DateTimeFormat('fr-FR').format(
                    new Date(
                      Number.isFinite(Date.parse(detail.updatedAt))
                        ? detail.updatedAt
                        : 0,
                    ),
                  )}
                  . Vérifie les conditions et les diplômes auprès de
                  l’employeur.
                </p>
                {detail.active &&
                detail.url &&
                safeExternalUrl(detail.url) &&
                !busy &&
                !error ? (
                  <a
                    className="primary-button"
                    href={detail.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Voir l’annonce et candidater <ArrowUpRight size={18} />
                  </a>
                ) : null}
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => react('like', detail)}
                >
                  <Heart size={18} />
                  Garder cette piste
                </button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="delete-dialog">
          <AlertDialogTitle>Supprimer ton compte ?</AlertDialogTitle>
          <AlertDialogDescription>
            Ton profil, tes favoris et tes réactions seront supprimés des
            données actives. Cette action est définitive. Les sauvegardes
            suivent leur délai de rétention.
          </AlertDialogDescription>
          <label className="form-stack">
            Écris SUPPRIMER
            <input
              autoComplete="off"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
            />
          </label>
          <label className="form-stack">
            Ton mot de passe
            <input
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
          </label>
          {deleteError && (
            <p className="error-message" role="alert">
              {deleteError}
            </p>
          )}
          <button
            className="primary-button danger-button"
            disabled={
              busy || deleteText !== 'SUPPRIMER' || deletePassword.length < 1
            }
            onClick={deleteAccount}
          >
            {busy ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
          <AlertDialogCancel>Garder mon compte</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
      <footer className="desktop-footer">
        <span>Annonces France Travail et partenaires</span>
        <a href="/confidentialite">Confidentialité</a>
      </footer>
    </div>
  );
}
