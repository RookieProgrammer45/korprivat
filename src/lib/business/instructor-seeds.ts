// @polsia:user-owned — deterministic instructor seed manifest. Imported by
// marketplace seed (server) and chatbot knowledge. Stable string IDs are
// intentional — see schema/instructors.prisma.
//
// Boot and `npm run db:seed` both upsert these rows (idempotent). Photos are
// local `/assets/**` paths so next/image's localPatterns allow-list can serve
// them without data-URL or remote-host workarounds.

export const SEED_IDS = {
  erik: 'instructor_erik',
  anna: 'instructor_anna',
  lina: 'instructor_lina',
  omar: 'instructor_omar',
} as const;

export type InstructorSeed = {
  id: string;
  name: string;
  city: string;
  serviceArea?: string;
  categories: string[];
  hourlyRateSek: number;
  bio: string;
  photoUrl: string;
  bookedHours: number;
  email: string;
  englishSpeaking: boolean;
  latitude?: number;
  longitude?: number;
  cancellationPolicyTier?: 'flexible' | 'moderate' | 'strict';
  bookingMode?: 'instant' | 'request';
  providerRole?: 'INSTRUCTOR' | 'HANDLEDARE';
};

export const seedRows: InstructorSeed[] = [
  {
    id: SEED_IDS.erik,
    name: 'Erik Lindqvist',
    city: 'Stockholm',
    serviceArea: 'Stockholm + 15 km',
    categories: ['B', 'A2'],
    hourlyRateSek: 550,
    bio: 'Stockholm-based instructor focusing on confident, real-world driving for first-time licence holders. Twelve years of teaching across the B syllabus, plus A2 stepping-stone riders moving up from A1.',
    photoUrl: '/assets/instructors/erik.svg',
    bookedHours: 124,
    email: 'erik@drivelinkup.test',
    englishSpeaking: false,
    latitude: 59.3293,
    longitude: 18.0686,
    bookingMode: 'instant',
  },
  {
    id: SEED_IDS.anna,
    name: 'Anna Sundberg',
    city: 'Göteborg',
    serviceArea: 'Göteborg + 20 km',
    categories: ['B', 'BE'],
    hourlyRateSek: 600,
    bio: 'Certified B and BE instructor in Gothenburg. Patient with anxious learners, meticulous on the manoeuvres section, and fluent in English and Swedish.',
    photoUrl: '/assets/instructors/anna.svg',
    bookedHours: 96,
    email: 'anna@drivelinkup.test',
    englishSpeaking: true,
    latitude: 57.7089,
    longitude: 11.9746,
    cancellationPolicyTier: 'moderate',
    bookingMode: 'request',
  },
  {
    id: SEED_IDS.lina,
    name: 'Lina Holm',
    city: 'Västerås',
    serviceArea: 'Västerås city + Mälaren',
    categories: ['B'],
    hourlyRateSek: 520,
    bio: 'Västerås instructor for first-time B learners. Calm dual-control lessons, strong on city traffic, and available after work hours.',
    photoUrl: '/assets/instructors/lina.svg',
    bookedHours: 64,
    email: 'lina@drivelinkup.test',
    englishSpeaking: true,
    latitude: 59.6099,
    longitude: 16.5448,
    bookingMode: 'instant',
  },
  {
    id: SEED_IDS.omar,
    name: 'Omar Nasser',
    city: 'Malmö',
    serviceArea: 'Malmö + Lund',
    categories: ['B', 'A'],
    hourlyRateSek: 580,
    bio: 'Malmö instructor covering B and A. Clear feedback, English and Swedish, and a focus on independent decision-making before the test.',
    photoUrl: '/assets/instructors/omar.svg',
    bookedHours: 81,
    email: 'omar@drivelinkup.test',
    englishSpeaking: true,
    latitude: 55.6044,
    longitude: 13.0038,
    bookingMode: 'instant',
  },
];
