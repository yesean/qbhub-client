import DOMPurify from 'dompurify';
import { toWords } from 'number-to-words';
import ReactHTMLParser from 'react-html-parser';
import { getRand } from './number';
import { betweenTags, getCaptureGroups } from './regex';

/**
 * Shuffle a string using Fischer-Yates shuffle.
 */
export const shuffleString = (s: string) => {
  const chars = s.split('');
  const shuffled = [];
  while (shuffled.length < s.length) {
    const randomIndex = getRand(chars.length);
    const [removedChar] = chars.splice(randomIndex, 1);
    shuffled.push(removedChar);
  }
  return shuffled.join('');
};

/**
 * Squeeze multiple spaces into one space.
 */
export const removeExtraSpaces = (s: string) => {
  return s.replaceAll(/\s\s+/g, ' ');
};

/**
 * Adjust spacing for power marking.
 */
export const cleanTossupText = (text: string) => {
  return removeExtraSpaces(
    text
      .replaceAll(/<\/strong>\s*\(\*\)/g, '(*) </strong>')
      .replaceAll(/\(\*\)/g, ' (*) '),
  );
};

/**
 * Sanitize and parse string into JSX.
 */
export const parseHTMLString = (s: string) =>
  ReactHTMLParser(DOMPurify.sanitize(s));

/**
 * Check if string is numberic.
 */
export const isNumeric = (s: string) => /^-?\d+$/.test(s);

/**
 * Convert number to words.
 * e.g. '1 dog' => 'one dog'
 */
export const convertNumberToWords = (s: string) =>
  s
    .split(' ')
    .map((w) => (isNumeric(w) ? toWords(w) : w))
    .join(' ');

/**
 * Get text between opening and closing tags.
 * e.g. <foo>bar</foo> => bar
 */
export const getTextBetweenTags = (text: string, t: string) =>
  getCaptureGroups(text, betweenTags(t));

/**
 * Check if a word is between opening and closing tags.
 * Used to check if a word is in power (strong tags).
 */
export const checkIfWordIsBetweenTags = (
  t: string,
  text: string,
  word: string,
) => {
  return getTextBetweenTags(text, t)?.includes(word);
};
