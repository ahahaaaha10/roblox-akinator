export type Region =
  | 'en' | 'en2' | 'en_objects' | 'en_animals' | 'ar' | 'cn' | 'de' | 'es'
  | 'fr' | 'fr_objects' | 'fr_animals' | 'il' | 'it' | 'jp' | 'jp_animals'
  | 'kr' | 'nl' | 'pl' | 'pt' | 'ru' | 'tr' | 'id';

export type Answer = 0 | 1 | 2 | 3 | 4 | 'y' | 'n' | 'idk' | 'p' | 'pn'
  | 'yes' | 'no' | 'probably' | 'probably not';

export interface AkinatorOptions { region?: Region; childMode?: boolean; }

export interface Question {
  question: string;
  step: number;
  progression: string;
  question_id?: string;
  completion?: string;
  answers?: string[];
}

export interface Guess {
  id?: string;
  name?: string;
  description?: string;
  photo?: string;
  pseudo?: string;
  flag_photo?: string | number;
}

export declare class Akinator {
  constructor(opts?: AkinatorOptions);
  region: Region;
  childMode: boolean;
  session: string | null;
  signature: string | null;
  step: number;
  progression: string;
  question: string | null;
  guessed: boolean;
  guess: Guess | null;
  finished: boolean;

  start(): Promise<Question>;
  answer(a: Answer): Promise<Question | { guess: Guess; step: number; progression: string }>;
  back(): Promise<Question>;
  win(): Promise<any>;
  exclude(): Promise<Question>;
  choice(): Promise<Guess>;
}

export default Akinator;
export const REGIONS: Region[];
