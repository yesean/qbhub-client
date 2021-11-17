import { Category, Subcategory, Difficulty } from './questions';

export type Tossup = {
  text: string;
  answer: string;
  formattedText: string;
  formattedAnswer: string;
  category: Category;
  subcategory: Subcategory;
  difficulty: Difficulty;
  tournament: string;
};

export enum TossupScore {
  neg = -5,
  ten = 10,
  power = 15,
}

export type TossupReaderWord = {
  original: string;
  shuffled: string;
  isInPower: boolean;
};

export type TossupBuzz = {
  isPower: boolean;
  readText: string;
  index: number;
  textWithBuzz: TossupReaderWord[];
};

export type TossupResult = {
  tossup: Tossup;
  isCorrect: boolean;
  submittedAnswer: string;
  score: TossupScore;
  buzz: TossupBuzz;
};