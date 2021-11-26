import { Center, CircularProgress, Container } from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectSettings } from '../Settings/settingsSlice';
import { TossupReaderWord } from '../types/tossups';
import logger from '../utils/logger';
import { getTextBetweenTags, renderQuestion } from '../utils/questionReader';
import { getReadingTimeoutDelay } from '../utils/settings';
import { shuffleString } from '../utils/string';
import {
  buzz,
  ReaderStatus,
  selectCurrentBuzz,
  selectCurrentTossup,
  selectStatus,
  setBuzz,
} from './tossupReaderSlice';

type PowerWordsCount = {
  [word: string]: number;
};

const getWords = (text: string) =>
  text.split(' ').map((w) => ({
    original: w,
    shuffled: shuffleString(w),
  }));

const getPowerWordsCount = (formattedText: string) => {
  const boldText =
    getTextBetweenTags('strong', formattedText).join(' ') ||
    getTextBetweenTags('b', formattedText).join(' ') ||
    '';

  return boldText
    .replaceAll(/<em>|<\/em>|<i>|<\/i>/g, '')
    .split(' ')
    .reduce<PowerWordsCount>((acc, w) => {
      const wCount = w in acc ? acc[w] + 1 : 1;
      return {
        ...acc,
        [w]: wCount,
      };
    }, {});
};

const Question: React.FC = () => {
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [incrementId, setIncrementId] = useState<NodeJS.Timeout | null>(null);
  const status = useSelector(selectStatus);
  const { text, formattedText } = useSelector(selectCurrentTossup);
  const settings = useSelector(selectSettings);
  const currentBuzz = useSelector(selectCurrentBuzz);
  const dispatch = useDispatch();

  const words: TossupReaderWord[] = useMemo(() => {
    const powerWordsCount = getPowerWordsCount(formattedText);
    return getWords(text).map((w) => {
      if (w.original in powerWordsCount && powerWordsCount[w.original] > 0) {
        powerWordsCount[w.original] -= 1;
        return { ...w, isInPower: true };
      }

      return { ...w, isInPower: false };
    });
  }, [text, formattedText]);

  const pauseWords = useCallback(() => {
    logger.info('Pausing tossup reading.');
    if (incrementId !== null) {
      window.clearTimeout(incrementId);
      setIncrementId(null);
    }
  }, [incrementId]);

  const revealWords = useCallback(() => {
    logger.info('Revealing rest of tossup.');
    setIncrementId(null);
    setVisibleIndex(words.length);
  }, [words.length]);

  // pause reading when answering
  useEffect(() => {
    if (status === ReaderStatus.answering) {
      pauseWords();
    }
  }, [pauseWords, status]);

  // reveal rest of tossup
  useEffect(() => {
    if (status === ReaderStatus.answered) {
      revealWords();
    }
  }, [revealWords, status]);

  // reset state when fetching new tossup
  useEffect(() => {
    if (status === ReaderStatus.fetching) {
      setVisibleIndex(0);
    }
  }, [status, incrementId]);

  // read tossup
  useEffect(() => {
    if (status === ReaderStatus.reading) {
      if (visibleIndex < words.length) {
        if (incrementId === null) {
          const readingDelay = getReadingTimeoutDelay(settings.readingSpeed);
          logger.info('Current reading speed:', readingDelay, 'ms/word');
          const incrementVisibleIndex = () => {
            setVisibleIndex(visibleIndex + 1);
            setIncrementId(null);
          };
          const id = setTimeout(incrementVisibleIndex, readingDelay);
          setIncrementId(id);
          const readText = words
            .slice(0, visibleIndex + 1)
            .map((w) => w.original)
            .join(' ');
          const lastWord = words[visibleIndex];
          const newCurrentBuzz = {
            readText,
            isPower: lastWord.isInPower,
            index: visibleIndex,
            textWithBuzz: words,
          };
          dispatch(setBuzz(newCurrentBuzz));
        }
      } else {
        dispatch(buzz());
      }
    }
  }, [
    dispatch,
    incrementId,
    settings.readingSpeed,
    status,
    visibleIndex,
    words,
  ]);
  return (
    <>
      {renderQuestion(
        words,
        status === ReaderStatus.reading ? -1 : currentBuzz.index,
        visibleIndex,
      )}
    </>
  );
};

const QuestionContainer: React.FC = () => {
  const status = useSelector(selectStatus);

  const shouldShowCircularProgress = status === ReaderStatus.fetching;
  const shouldShowEmptyMsg = status === ReaderStatus.empty;

  const render = () => {
    if (shouldShowCircularProgress) {
      return (
        <Center>
          <CircularProgress isIndeterminate color="cyan.100" />
        </Center>
      );
    }
    if (shouldShowEmptyMsg) {
      return 'No tossups found. Try tweaking the search parameters.';
    }
    return <Question />;
  };

  return (
    <Container
      maxW="container.md"
      bg="gray.100"
      w="100%"
      mb={4}
      p={4}
      d="flex"
      flexWrap="wrap"
      justifyContent={shouldShowCircularProgress ? 'center' : 'start'}
      borderRadius="md"
    >
      {render()}
    </Container>
  );
};

export default QuestionContainer;