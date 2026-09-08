'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import { demoJobs } from '@/lib/demo';
import {
  defaultProfile,
  interests,
  kindLabels,
  rejectionReasons,
  type Job,
  type Profile,
  type Reaction,
} from '@/lib/model';
import { recommend, learnedWeights } from '@/lib/recommendations';
import { api, ApiError } from '@/lib/client';
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
import { registerDiscoveryTools, type ModelContext } from '@/lib/webmcp';
const demoProfile = {
  ...defaultProfile,
  city: 'Lyon',
  commune: '69123',
  lat: 45.764,
  lon: 4.835,
};
type Panel = 'auth' | 'profile' | 'detail' | 'reason' | null;
export default function Discovery() {
  const [tab, setTab] = useState('discover');
  const [panel, setPanel] = useState<Panel>(null);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [status, setStatus] = useState({
    accounts: false,
    offers: false,
    ai: false,
  });
  const [profile, setProfile] = useState<Profile>(demoProfile);
  const [jobs, setJobs] = useState<Job[]>(demoJobs);
  const [feedback, setFeedback] = useState<Reaction[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [surprise, setSurprise] = useState(false);
  const [detail, setDetail] = useState<Job | null>(null);
  const [last, setLast] = useState<{
    reaction: Reaction;
    previous?: Reaction;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [partial, setPartial] = useState(false);
  const [savedFilter, setSavedFilter] = useState('all');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const pending = useRef(false);
  const cards = recommend(jobs, profile, feedback, {
    surprise,
    skipped,
    offset: feedback.length + skipped.length,
  });
  const current = cards[0];
  const demo = !user;
  const saved = feedback.filter(
    (f) =>
      f.verdict !== 'reject' &&
      (savedFilter === 'all' || f.verdict === savedFilter),
  );
  const learned = useMemo(() => learnedWeights(feedback), [feedback]);
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(
    () =>
      registerDiscoveryTools(
        (document as Document & { modelContext?: ModelContext }).modelContext,
        () =>
          currentRef.current
            ? {
                title: currentRef.current.job.title,
                company: currentRef.current.job.company,
                kind: currentRef.current.kind,
                explanation: currentRef.current.explanation,
              }
            : null,
        setTab,
      ),
    [],
  );
  async function loadOffers(p: Profile) {
    setSourceError('');
    setLoading(true);
    try {
      if (!p.completed) {
        setJobs([]);
        return;
      }
      const r = await api<{ jobs: Job[]; partial: boolean }>('offers');
      setJobs(r.jobs);
      setPartial(r.partial);
      setSkipped([]);
    } catch (e) {
      setJobs([]);
      setSourceError((e as Error).message);
    } finally {
      setLoading(false);
    }
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
    setLast(null);
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
            'Impossible de vérifier la disponibilité des comptes. La démonstration reste accessible.',
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  async function saveProfile(p: Profile) {
    if (user) await api('profile', 'PUT', p);
    setProfile(p);
    setPanel(null);
    setSkipped([]);
    setNotice(
      user
        ? 'Tes préférences sont enregistrées.'
        : 'Préférences appliquées à la démonstration, sans enregistrement.',
    );
    if (user) await loadOffers(p);
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
      if (user)
        await api('feedback', 'POST', { job_id: job.id, verdict, reason });
      setFeedback((f) => [reaction, ...f.filter((x) => x.job_id !== job.id)]);
      setLast({
        reaction,
        previous:
          !askReason && last?.reaction.job_id === job.id
            ? last.previous
            : previous,
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
    if (!last || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (user) {
        if (last.previous) await api('feedback', 'POST', last.previous);
        else
          await api(
            `feedback?id=${encodeURIComponent(last.reaction.job_id)}`,
            'DELETE',
          );
      }
      setFeedback((f) => [
        ...(last.previous ? [last.previous] : []),
        ...f.filter((x) => x.job_id !== last.reaction.job_id),
      ]);
      setSkipped((s) => s.filter((id) => id !== last.reaction.job_id));
      setLast(null);
      setNotice('Ton dernier choix a été annulé.');
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
      if (user)
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
  async function showDetail(job: Job) {
    setDetail(job);
    setPanel('detail');
    setError('');
    if (user) {
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
  }
  function surpriseNow() {
    if (current) setSkipped((s) => [...s, current.job.id]);
    setSurprise(true);
    setNotice('Place à une autre piste. Tes contraintes restent respectées.');
  }
  function resetDemo() {
    setUser(null);
    setProfile(demoProfile);
    setJobs(demoJobs);
    setFeedback([]);
    setSkipped([]);
    setLast(null);
    setPanel(null);
    setTab('discover');
    setNotice(
      'Tu es dans la démonstration. Aucune donnée personnelle n’y est conservée.',
    );
    setSourceError('');
  }
  async function logout() {
    setBusy(true);
    try {
      await api('auth/logout', 'POST', {});
      resetDemo();
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
      resetDemo();
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
        <Link prefetch={false} className="wordmark" href="/">
          jobdiscover<span className="wordmark-dot">.</span>
        </Link>
        <span className="edition">DE NOUVELLES PERSPECTIVES</span>
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
            <aside className="intro">
              <span className="eyebrow">UN PAS VERS LA SUITE</span>
              <h1>
                Et si ton prochain
                <br />
                travail te <em>surprenait ?</em>
              </h1>
              <p>
                Des pistes à explorer, à ton rythme.
                <br />
                Tu n’as pas besoin d’avoir tout décidé.
              </p>
              <div className="aside-note">
                <span className="tiny-label">LE PRINCIPE</span>
                <p>
                  Ce qui t’attire nous guide.
                  <br />
                  La curiosité fait le reste.
                </p>
                <MoveUpRight size={30} strokeWidth={1} />
              </div>
            </aside>
            <section
              className="discovery-column"
              aria-label="Offres à découvrir"
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {demo ? 'PREMIÈRES PISTES' : 'TA SÉLECTION'}
                  </span>
                  <h2>À découvrir aujourd’hui</h2>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setPanel('profile')}
                  aria-label="Modifier mes filtres"
                >
                  <SlidersHorizontal size={20} />
                </button>
              </div>
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
                {profile.noWeekend && <span>Sans week-end</span>}
                {profile.noNight && <span>Sans nuit</span>}
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
              ) : loading && user ? (
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
                    <div className="card-ribbon">
                      <span>
                        <Compass size={16} />
                        {kindLabels[current.kind].toLocaleUpperCase('fr')}
                      </span>
                      <span>
                        {String(feedback.length + skipped.length + 1).padStart(
                          2,
                          '0',
                        )}
                      </span>
                    </div>
                    <div className="job-body">
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
                  </article>
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
                </>
              ) : (
                <div className="empty-state">
                  <Compass size={34} />
                  <h3>
                    {user && !profile.completed
                      ? 'On fait connaissance ?'
                      : 'Tu as exploré ces pistes.'}
                  </h3>
                  <p>
                    {user && !profile.completed
                      ? 'Quelques envies et une commune suffisent pour commencer.'
                      : 'Aucune autre offre ne correspond ici à tes critères. Tu peux revoir les offres passées ou modifier tes filtres.'}
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => setPanel('profile')}
                  >
                    Ajuster mes préférences
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
                      onClick={() => loadOffers(profile)}
                    >
                      Chercher de nouvelles offres
                    </button>
                  )}
                </div>
              )}
              <div className="below-actions">
                <button disabled={!last || busy} onClick={undo}>
                  <RotateCcw size={14} />
                  Annuler
                </button>
                {current ? (
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
                ) : (
                  <span>Aucune réponse n’est définitive.</span>
                )}
              </div>
              <button
                className="mobile-surprise text-button"
                onClick={surpriseNow}
                disabled={!current}
              >
                Surprends-moi <MoveUpRight size={16} />
              </button>
              {partial && (
                <p className="form-help">
                  Sélection parmi les 300 offres récentes récupérées dans cette
                  zone.
                </p>
              )}
              {demo ? (
                <div className="demo-note">
                  Démonstration · Offres fictives
                  <br />
                  <button
                    className="text-button"
                    onClick={() => setPanel('auth')}
                  >
                    Créer mon espace pour garder mes pistes{' '}
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              ) : (
                <p className="demo-note">
                  Offres France Travail et partenaires · Disponibilité à
                  vérifier
                </p>
              )}
            </section>
            <aside className="right-note">
              <span className="vertical-rule" />
              <span className="eyebrow">GARDE L’ESPRIT OUVERT</span>
              <p>Le bon métier n’est pas toujours celui auquel on pense.</p>
              <button
                className="text-button"
                onClick={surpriseNow}
                disabled={!current}
              >
                Surprends-moi <ArrowRight size={16} />
              </button>
              <div className="discovery-note">
                Tes contraintes sont respectées, même quand on sort des sentiers
                battus.
              </div>
            </aside>
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
            {demo && (
              <p className="notice">
                Favoris de démonstration : ils disparaissent en quittant ou en
                rechargeant la page.
              </p>
            )}
            {saved.length === 0 ? (
              <div className="empty-state">
                <Heart size={32} />
                <h3>La bonne piste viendra.</h3>
                <p>
                  Les offres qui te plaisent ou t’intriguent t’attendront ici.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setTab('discover')}
                >
                  Découvrir des offres <ArrowRight size={17} />
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
            <span className="eyebrow">UNE RECHERCHE QUI TE RESSEMBLE</span>
            <h1>Ce qui compte pour toi.</h1>
            {!user ? (
              <>
                <p>
                  Essaie tes préférences dans la démonstration, ou crée un
                  compte pour les retrouver.
                </p>
                <div className="profile-section">
                  <button
                    className="primary-button"
                    onClick={() => setPanel('auth')}
                  >
                    Créer mon espace <ArrowRight size={18} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setPanel('profile')}
                  >
                    Essayer le questionnaire
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="private-account">
                  <ShieldCheck size={17} />
                  Espace privé · {user.email}
                </p>
                <div className="profile-section">
                  <div className="section-heading">
                    <h2>Mes préférences</h2>
                    <button
                      className="text-button"
                      onClick={() => setPanel('profile')}
                    >
                      Modifier <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <p>
                    {profile.city || 'Commune à compléter'} · {profile.radius}{' '}
                    km ·{' '}
                    {profile.contracts.length
                      ? profile.contracts.join(', ')
                      : 'Tous les contrats'}
                  </p>
                  <div className="choices">
                    {profile.interests.map((t) => (
                      <span className="choice selected" key={t}>
                        {interests[t]}
                      </span>
                    ))}
                    {!profile.interests.length && (
                      <span>Encore toutes les possibilités.</span>
                    )}
                  </div>
                </div>
              </>
            )}
            <div className="profile-section">
              <h2>Ce que tes choix dessinent</h2>
              <p>
                Ces tendances viennent de tes réactions. Elles évoluent et ne
                remplacent jamais tes préférences.
              </p>
              {Object.entries(learned).filter(([, v]) => v > 0.25).length ? (
                <div className="choices">
                  {Object.entries(learned)
                    .filter(([, v]) => v > 0.25)
                    .map(([key]) => (
                      <span className="choice" key={key}>
                        {interests[key as keyof typeof interests]}
                      </span>
                    ))}
                </div>
              ) : (
                <p className="form-help">
                  Encore trop peu de réactions pour dégager une tendance.
                </p>
              )}
              <button
                className="text-button"
                onClick={() => setPanel('profile')}
              >
                Corriger mes envies <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="profile-section">
              <h2>Ta vie privée reste privée.</h2>
              <p>
                Tes coordonnées, tes préférences et tes réactions ne sont pas
                envoyées à DeepSeek. Aucun autre membre ne peut consulter ton
                profil.
              </p>
              <Link
                prefetch={false}
                className="text-button"
                href="/confidentialite"
              >
                Comprendre les données conservées <ArrowUpRight size={16} />
              </Link>
              {user && (
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
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      {(error || notice) && (
        <div
          className={`feedback-notice ${error ? 'is-error' : ''}`}
          role={error ? 'alert' : 'status'}
        >
          <span>{error || notice}</span>
          <button
            aria-label="Fermer le message"
            onClick={() => {
              setError('');
              setNotice('');
            }}
          >
            <X size={17} />
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
                : panel === 'profile'
                  ? 'Mes envies & mes filtres'
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
            {panel === 'profile' && (
              <ProfileEditor
                initial={profile}
                demo={demo}
                onSave={saveProfile}
              />
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
                <span className="eyebrow">
                  {detail.demo
                    ? 'EXEMPLE FICTIF'
                    : 'FRANCE TRAVAIL & PARTENAIRES'}
                </span>
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
                  <Link
                    prefetch={false}
                    className="primary-button"
                    href={detail.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Voir l’annonce et candidater <ArrowUpRight size={18} />
                  </Link>
                ) : detail.demo ? (
                  <p className="notice">
                    Cette offre est fictive. Aucune candidature n’est possible.
                  </p>
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
              busy || deleteText !== 'SUPPRIMER' || deletePassword.length < 12
            }
            onClick={deleteAccount}
          >
            {busy ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
          <AlertDialogCancel>Garder mon compte</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
      <footer className="desktop-footer">
        <span>Un peu de curiosité. De nouvelles possibilités.</span>
        <Link prefetch={false} href="/confidentialite">
          Confidentialité
        </Link>
      </footer>
    </div>
  );
}
