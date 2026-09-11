export const interests = {
  organiser: 'Organiser',
  aider: 'Aider les autres',
  creer: 'Créer',
  accueillir: 'Échanger & accueillir',
  manuel: 'Faire avec ses mains',
  analyser: 'Analyser',
  nature: 'Travailler dehors',
  vendre: 'Conseiller & vendre',
} as const;
export type Interest = keyof typeof interests;
export const educationLabels = {
  unspecified: 'Non précisé',
  none: 'Sans diplôme (niveau collège)',
  cap: 'CAP / BEP',
  bac: 'Baccalauréat',
  bac2: 'Bac +2 (BTS, DUT)',
  bac3: 'Bac +3 (Licence)',
  bac5: 'Bac +5 et plus (Master, Doctorat)',
} as const;
export type Education = keyof typeof educationLabels;
export const domainPreferenceLabels = {
  related: 'Voir des offres liées à mon domaine',
  avoid: 'Ne pas voir mon domaine',
  any: 'Peu importe',
} as const;
export type DomainPreference = keyof typeof domainPreferenceLabels;
export type DesireAnalysis = {
  summary: string;
  interests: Interest[];
  avoids: Interest[];
  domains: string[];
};
export type Profile = {
  city: string;
  commune: string;
  lat: number | null;
  lon: number | null;
  radius: number;
  interests: Interest[];
  avoid: Interest[];
  weights: Partial<Record<Interest, number>>;
  contracts: string[];
  noNight: boolean;
  noWeekend: boolean;
  training: boolean;
  experience: 'any' | 'beginner';
  discovery: number;
  education: Education;
  domain: string;
  domainPreference: DomainPreference;
  desires: string;
  completed: boolean;
};
export const defaultProfile: Profile = {
  city: '',
  commune: '',
  lat: null,
  lon: null,
  radius: 30,
  interests: [],
  avoid: [],
  weights: {},
  contracts: [],
  noNight: false,
  noWeekend: false,
  training: true,
  experience: 'any',
  discovery: 40,
  education: 'unspecified',
  domain: '',
  domainPreference: 'any',
  desires: '',
  completed: false,
};
export const activityExamples: { label: string; hint: string; tag: Interest }[] =
  [
    { label: 'Organiser des événements', hint: 'Concerts, conférences, salons', tag: 'organiser' },
    { label: 'Gérer un planning et une équipe', hint: 'Coordonner, répartir, suivre', tag: 'organiser' },
    { label: 'Assurer le suivi administratif', hint: 'Courriers, dossiers, classement', tag: 'organiser' },
    { label: 'Accompagner des personnes fragiles', hint: 'Personnes âgées, handicap, difficultés', tag: 'aider' },
    { label: 'Travailler dans le social', hint: 'Insertion, logement, animation sociale', tag: 'aider' },
    { label: 'Soigner et aider à domicile', hint: 'Aide à la personne, petits soins', tag: 'aider' },
    { label: 'Créer des visuels et des contenus', hint: 'Graphisme, vidéo, réseaux sociaux', tag: 'creer' },
    { label: 'Écrire, concevoir, inventer', hint: 'Rédaction, design, nouveaux produits', tag: 'creer' },
    { label: 'Travailler dans la culture', hint: 'Musées, spectacles, médiation culturelle', tag: 'creer' },
    { label: 'Accueillir et renseigner le public', hint: 'Accueil physique et téléphonique', tag: 'accueillir' },
    { label: 'Être en relation avec les clients', hint: 'Conseil, support, fidélisation', tag: 'accueillir' },
    { label: 'Animer des ateliers', hint: 'Enfants, adultes, collectifs', tag: 'accueillir' },
    { label: 'Réparer et entretenir', hint: 'Véhicules, équipements, bâtiment', tag: 'manuel' },
    { label: 'Fabriquer de ses mains', hint: 'Menuiserie, mécanique, montage', tag: 'manuel' },
    { label: 'Travailler en atelier', hint: 'Production, assemblage, finition', tag: 'manuel' },
    { label: 'Analyser des données', hint: 'Chiffres, statistiques, tableaux de bord', tag: 'analyser' },
    { label: 'Gérer la comptabilité', hint: 'Factures, paie, bilan', tag: 'analyser' },
    { label: 'Contrôler la qualité', hint: 'Vérifications, conformité, procédures', tag: 'analyser' },
    { label: 'Travailler en extérieur', hint: 'Chantiers, tournées, plein air', tag: 'nature' },
    { label: 'Jardiner, aménager les espaces verts', hint: 'Paysage, plantations, entretien', tag: 'nature' },
    { label: 'Travailler dans l’agriculture', hint: 'Culture, élevage, environnement', tag: 'nature' },
    { label: 'Vendre et conseiller en magasin', hint: 'Rayons, caisse, clientèle', tag: 'vendre' },
    { label: 'Développer le commerce', hint: 'Prospection, fidélisation, ventes', tag: 'vendre' },
    { label: 'Négocier des contrats', hint: 'B2B, partenariats, appels d’offres', tag: 'vendre' },
  ];
export type Job = {
  id: string;
  title: string;
  company: string;
  city: string;
  lat: number | null;
  lon: number | null;
  contract: string;
  salary: string;
  summary: string;
  description: string;
  tags: Interest[];
  sector: string;
  experienceRequired: boolean;
  night: boolean | null;
  weekend: boolean | null;
  url: string | null;
  updatedAt: string;
  active: boolean;
};
export type Reaction = {
  job_id: string;
  verdict: 'like' | 'maybe' | 'reject';
  reason: string | null;
  job: Job;
  created_at?: string;
};
export type Recommendation = {
  job: Job;
  kind: 'match' | 'neighbor' | 'discovery';
  explanation: string;
  score: number;
};
export const kindLabels = {
  match: 'Dans tes envies',
  neighbor: 'Une piste voisine',
  discovery: 'Une découverte',
};
export const rejectionReasons = {
  missions: 'Les missions',
  distance: 'Le trajet',
  salary: 'Le salaire',
  hours: 'Les horaires',
  qualification: 'Les qualifications',
  other: 'Autre chose',
};
