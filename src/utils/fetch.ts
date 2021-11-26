import axios from 'axios';
import { Category, Difficulty, Subcategory } from '../types/questions';
import { Tossup, Clue, Answer } from '../types/tossups';
import logger from './logger';
import { cleanTossupText } from './string';

const API_URL = '/api';
const TOSSUP_URL = `${API_URL}/tossups`;
const FREQ_URL = `${API_URL}/freq`;
const CLUES_URL = `${API_URL}/clues`;

export const combineParams = (...params: string[]) =>
  params.filter(Boolean).join('&');
export const createParamsFromArray = (field: string, values: any[]) =>
  combineParams(...values.map((val) => `${field}[]=${val}`));
export const addParams = (url: string, params: string) => `${url}?${params}`;

type FetchParams = {
  categories?: Category[];
  subcategories?: Subcategory[];
  difficulties?: Difficulty[];
  text?: string;
  answer?: string;
  limit?: number;
  offset?: number;
};

const createParams = ({
  categories = [],
  subcategories = [],
  difficulties = [],
  text = '',
  answer = '',
  limit = 10,
  offset = 0,
}: FetchParams) =>
  combineParams(
    createParamsFromArray('categories', categories),
    createParamsFromArray('subcategories', subcategories),
    createParamsFromArray('difficulties', difficulties),
    text.length ? `text=${text}` : '',
    answer.length ? `answer=${answer}` : '',
    `limit=${limit}`,
    `offset=${offset}`,
  );

export const fetchTossups = async (params: FetchParams): Promise<Tossup[]> => {
  const url = addParams(TOSSUP_URL, createParams(params));

  try {
    logger.info('Fetching tossups.');
    const { data } = await axios.get(url);
    const tossups = data.map((tu: any) => ({
      text: cleanTossupText(tu.text),
      answer: tu.answer,
      formattedText: cleanTossupText(tu.formatted_text),
      formattedAnswer: tu.formatted_answer,
      category: tu.category,
      subcategory: tu.subcategory,
      difficulty: tu.difficulty,
      tournament: tu.tournament,
    }));
    logger.info('Received tossups.');
    return tossups;
  } catch (err) {
    return [];
  }
};

export const fetchFreq = async (params: FetchParams): Promise<Answer[]> => {
  const url = addParams(FREQ_URL, createParams(params));

  try {
    logger.info('Fetching frequency list.');
    const { data } = await axios.get(url);
    logger.info('Received frequency list.');
    return data;
  } catch (err) {
    return [];
  }
};

export const fetchAnswers = async (params: FetchParams): Promise<Answer[]> => {
  const url = addParams(FREQ_URL, createParams(params));

  try {
    logger.info('Fetching answers.');
    const { data } = await axios.get(url);
    logger.info('Received answers.');
    return data;
  } catch (err) {
    return [];
  }
};

export const fetchClues = async (params: FetchParams): Promise<Clue[]> => {
  const url = addParams(CLUES_URL, createParams(params));

  try {
    logger.info('Fetching clues.');
    const { data } = await axios.get(url);
    logger.info('Received clues.');
    return data;
  } catch (err) {
    return [];
  }
};
