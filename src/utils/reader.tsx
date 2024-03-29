import { BellIcon } from '@chakra-ui/icons';
import { Container, Text } from '@chakra-ui/react';
import nlp from 'compromise';
import { Fragment } from 'react';
import ss from 'string-similarity';
import { BonusPartResult, BonusScore } from '../types/bonus';
import { JudgeResult, TossupScore, TossupWord } from '../types/tossups';
import { combine, emptyStringFilter, getUnique } from './array';
import logger from './logger';
import {
  anyTag,
  getCaptureGroups,
  ltgt,
  quotes,
  remove,
  removeNonAlphanumeric,
  removeTags,
} from './regex';
import {
  convertNumberToWords,
  getTextBetweenTags,
  getWords,
  getWordsBetweenTags,
  multipleLastIndexOf,
  normalizeSpacing,
  parseHTMLString,
  removeFirstNames,
} from './string';

/**
 * Get words from string without any tags.
 * e.g. I <strong>love</strong> dogs => [I, love, dogs]
 */
export const getTossupWords = (text: string): TossupWord[] => {
  const boldWords = getWordsBetweenTags(text, 'strong').map(removeTags);
  const words = getWords(removeTags(text));

  let boldWordIndex = 0;
  const tossupWords = words.map((word) => {
    if (boldWordIndex < boldWords.length && word === boldWords[boldWordIndex]) {
      boldWordIndex += 1;
      return { word, bold: true };
    }
    return { word, bold: false };
  });

  return tossupWords;
};

/**
 * Get power index from tossup text.
 */
export const getPowerIndex = (tossupWords: TossupWord[]) => {
  const POWER_MARKER = '(*)';
  return tossupWords.findIndex(({ word }) => word === POWER_MARKER);
};

/**
 * Calculate tossup score based on buzz.
 */
export const getTossupScore = (
  isCorrect: boolean,
  isInPower: boolean,
  didBuzzAtEnd: boolean,
) => {
  if (isCorrect) {
    return isInPower ? TossupScore.power : TossupScore.ten;
  }
  return didBuzzAtEnd ? TossupScore.incorrect : TossupScore.neg;
};

export const getBonusScore = (results: BonusPartResult[]) => {
  const correctCount = results.reduce(
    (acc, res) => acc + (res.isCorrect ? 1 : 0),
    0,
  );

  if (correctCount === 3) {
    return BonusScore.thirty;
  }
  if (correctCount === 2) {
    return BonusScore.twenty;
  }
  if (correctCount === 1) {
    return BonusScore.ten;
  }
  return BonusScore.zero;
};

/**
 * Render a question given its reading position. Display the buzz symbol if
 * specified.
 */
export const renderQuestion = (
  words: { word: string; bold: boolean }[],
  indices?: { visible?: number; buzz?: number },
  visibleRef?: React.RefObject<HTMLParagraphElement>,
) => {
  const { visible = words.length, buzz = -1 } = indices ?? {};
  const renderBell = (shouldRender: boolean) => {
    if (shouldRender) {
      return (
        <Container
          color="cyan.500"
          m={0}
          p={0}
          w="auto"
          display="inline-flex"
          alignItems="center"
          whiteSpace="pre"
          verticalAlign="bottom"
        >
          <BellIcon w={4} h={4} />
          <Text display="inline"> </Text>
        </Container>
      );
    }
    return null;
  };

  return words.map((w, i) => (
    <Fragment key={`${w}${i}`}>
      <Text
        /* eslint react/no-array-index-key: "off" */
        ref={i === visible ? visibleRef : undefined}
        display="inline-block"
        whiteSpace="break-spaces"
        visibility={i <= visible ? 'visible' : 'hidden'}
        fontWeight={w.bold ? 'bold' : 'normal'}
      >
        {parseHTMLString(w.word)}{' '}
      </Text>
      {renderBell(i === buzz)}
    </Fragment>
  ));
};

/**
 * Clean a tossup answerline for parsing.
 */
const cleanAnswerline = (s: string) =>
  normalizeSpacing(
    s
      .replaceAll(ltgt, '') // remove author metadata
      .replaceAll(/\((?!accept|or|prompt).*?\)/g, '') // remove parenthesized stuff if the information is not important
      .replaceAll('(', '[')
      .replaceAll(')', ']'),
  );

/**
 * Normalize answer for comparison.
 */
export const normalizeAnswer = (s: string) =>
  normalizeSpacing(
    removeNonAlphanumeric(
      convertNumberToWords(
        nlp(s).normalize('light').text().replaceAll(quotes, ''),
      ).toLowerCase(),
    ),
  );

/**
 * Filters out negated answers such as 'do not accept foo' or 'do not prompt on
 * or accept bar'. Used as a drop-in replacement for lookbehind assertions
 * (not supported in Safari) in the answer parser regex.
 * Answerlines often take the form 'do not accept foo or bar' and the answer
 * regex will match at 'accept' or 'or' so a lookup has to be performed to ensure
 * that an answer isn't proceeded by 'do not' or some other form of negation.
 */
const filterNegativeAnswers = (
  matchArray: RegExpExecArray,
  answerType: 'accept' | 'prompt',
) => {
  const { 0: match, index, input } = matchArray;
  const answerPrefix = match.slice(1).split(' ')[0];

  if (answerType === 'accept' && answerPrefix === 'accept') {
    const negatives = ['do not', 'do not prompt on or', 'do not prompt or'];
    return negatives.every((neg) => !input.endsWith(neg, index));
  }

  if (answerType === 'prompt' && answerPrefix === 'prompt') {
    const negatives = ['do not', 'do not accept or'];
    return negatives.every((neg) => !input.endsWith(neg, index));
  }

  const startIndex = multipleLastIndexOf(input, [';', ',', '['], index);
  const prevString = input.slice(startIndex, index);

  if (answerType === 'accept' && answerPrefix === 'or') {
    const negatives = ['do not accept', 'prompt on', 'prompt'];
    return negatives.every((neg) => !prevString.includes(neg));
  }

  if (answerType === 'prompt' && answerPrefix === 'or') {
    const promptIndex = prevString.lastIndexOf('prompt on');
    if (promptIndex === -1) return false;

    const negatives = ['do not ', 'do not accept or '];
    return negatives.every((neg) => !prevString.endsWith(neg, promptIndex));
  }

  return true;
};

/**
 * Parse all valid answers from an answerline.
 */
export const parseAcceptableAnswers = (answerline: string): string[] => {
  let normalizedAnswer = cleanAnswerline(answerline);

  // get bolded answers
  const boldAnswers = getTextBetweenTags(normalizedAnswer, 'strong').map(
    removeTags,
  );

  // remove tags since they are not needed anymore
  normalizedAnswer = remove(normalizedAnswer, anyTag);

  // parse acceptable answers, roughly based on acf guidelines
  const primaryAnswer = /^(.*?)(?:$|(?:\[| or ).*)/g; // first answer up to '[' or EOL
  const acceptableAnswers =
    /(?:[[,; ])(?:accept |or )(.*?)(?= (?:do not|prompt|accept|or|until|before|after) |[,;[\]]|$)/g;
  const answers = [
    ...getCaptureGroups(normalizedAnswer, primaryAnswer),
    ...(
      Array.from(
        normalizedAnswer.matchAll(acceptableAnswers),
      ) as RegExpExecArray[]
    )
      .filter((match) => filterNegativeAnswers(match, 'accept'))
      .map((e) => e[1]),
  ];

  let allAnswers = combine(boldAnswers, answers);
  const answersWithoutFirstNames = allAnswers.map(removeFirstNames);
  allAnswers = combine(allAnswers, answersWithoutFirstNames)
    .map(normalizeAnswer)
    .filter(emptyStringFilter);

  return getUnique(allAnswers);
};

/**
 * Parse all promptable answers from an answerline.
 */
export const parsePromptableAnswers = (answer: string) => {
  let normalizedAnswer = cleanAnswerline(answer);

  // get underlined answers
  const underlinedAnswers = getTextBetweenTags(normalizedAnswer, 'u').map(
    removeTags,
  );

  // remove tags since they are not needed anymore
  normalizedAnswer = remove(normalizedAnswer, anyTag);

  // parse promptable answers, roughly based on acf guidelines
  const promptRegex =
    /(?:[[,; ])(?:prompt on |or )(.*?)(?= (?:do not|prompt|accept|or|until|before|after) |[,;[\]]|$)/g;
  const prompts = (
    Array.from(normalizedAnswer.matchAll(promptRegex)) as RegExpExecArray[]
  )
    .filter((match) => filterNegativeAnswers(match, 'prompt'))
    .map((e) => e[1]);

  const allAnswers = combine(underlinedAnswers, prompts)
    .map(normalizeAnswer)
    .filter(emptyStringFilter);

  return getUnique(allAnswers);
};

/**
 * Check if an answer "approximately" matches any correct answers. Uses Dice's
 * coefficient to compare strings.
 */
const checkAnswer = (userAnswer: string, answers: string[]) => {
  if (answers.length === 0)
    return {
      ratings: [],
      bestMatch: {
        rating: 0,
      },
      bestMatchIndex: -1,
    };

  return ss.findBestMatch(userAnswer, answers);
};

/**
 * Class for judging user answers against an answerline, supports prompts.
 */
export class Judge {
  acceptableAnswers: string[];

  promptableAnswers: string[];

  constructor(answerline: string) {
    this.acceptableAnswers = parseAcceptableAnswers(answerline);
    this.promptableAnswers = parsePromptableAnswers(answerline);
    logger.info('Correct answers:', this.acceptableAnswers);
    logger.info('Promptable answers:', this.promptableAnswers);
  }

  judge(userAnswer: string): JudgeResult {
    const MIN_RATING = 0.6;

    let ratings = checkAnswer(userAnswer, this.acceptableAnswers);
    logger.info(
      `Acceptable answer ratings for "${userAnswer}":`,
      ratings.ratings,
    );
    if (ratings.bestMatch.rating > MIN_RATING) {
      return JudgeResult.correct;
    }

    if (this.promptableAnswers.length > 0) {
      ratings = checkAnswer(userAnswer, this.promptableAnswers);
      logger.info(
        `Promptable answer ratings for "${userAnswer}":`,
        ratings.ratings,
      );
      if (ratings.bestMatch.rating > MIN_RATING) {
        // remove promptable answer, so it does not get prompted again
        this.promptableAnswers.splice(ratings.bestMatchIndex, 1);
        return JudgeResult.prompt;
      }
    }

    return JudgeResult.incorrect;
  }
}
