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
export type Profile = {
  city: string;
  commune: string;
  lat: number | null;
  lon: number | null;
  radius: number;
  interests: Interest[];
  avoid: Interest[];
  contracts: string[];
  noNight: boolean;
  noWeekend: boolean;
  training: boolean;
  experience: 'any' | 'beginner';
  discovery: number;
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
  contracts: [],
  noNight: false,
  noWeekend: false,
  training: true,
  experience: 'any',
  discovery: 40,
  completed: false,
};
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
  demo?: boolean;
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
