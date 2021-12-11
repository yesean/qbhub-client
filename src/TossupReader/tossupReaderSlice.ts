import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../app/store';
import { Category, Difficulty, Subcategory } from '../types/questions';
import { Tossup, TossupBuzz, TossupResult } from '../types/tossups';
import * as fetchUtils from '../utils/fetch';

export enum ReaderStatus {
  idle,
  fetching,
  reading,
  answering,
  prompting,
  judged,
  empty,
}

type TossupReaderState = {
  status: ReaderStatus;
  tossups: Tossup[];
  results: TossupResult[];
  currentTossup: Tossup;
  currentResult: TossupResult;
  currentBuzz: TossupBuzz;
  score: number;
};

const initialState: TossupReaderState = {
  status: ReaderStatus.idle,
  tossups: [],
  results: [],
  score: 0,
  currentTossup: {} as Tossup,
  currentResult: {} as TossupResult,
  currentBuzz: { isPower: false, readText: '', index: 0, textWithBuzz: [] },
};

export const fetchTossups = createAsyncThunk<
  Tossup[],
  undefined,
  { state: RootState }
>('tossupReader/fetchTossups', async (_, { getState }) => {
  const { settings } = getState();
  const tossups = await fetchUtils.fetchTossups(settings);
  return tossups;
});

export const nextTossup = createAsyncThunk<
  void,
  undefined,
  { state: RootState }
>(
  'tossupReader/nextTossup',
  async (_, { dispatch, getState }) => {
    const { tossupReader } = getState();
    // if tossup cache is low, fetch more
    // if tossup cache is empty, keep the action pending
    if (tossupReader.tossups.length === 0) {
      await dispatch(fetchTossups()).unwrap();
    } else if (tossupReader.tossups.length < 5) {
      dispatch(fetchTossups());
    }
  },
  {
    condition: (_, { getState }) => {
      const { tossupReader } = getState();
      return [ReaderStatus.idle, ReaderStatus.judged].includes(
        tossupReader.status,
      );
    },
  },
);

const tossupReaderSlice = createSlice({
  name: 'tossupReader',
  initialState,
  reducers: {
    buzz: (state) => {
      if (state.status === ReaderStatus.reading) {
        state.status = ReaderStatus.answering;
      }
    },
    setBuzz: (state, action: PayloadAction<TossupBuzz>) => {
      state.currentBuzz = action.payload;
    },
    prompt: (state) => {
      if (
        [ReaderStatus.answering, ReaderStatus.prompting].includes(state.status)
      ) {
        state.status = ReaderStatus.prompting;
      }
    },
    submitAnswer: (state, action: PayloadAction<TossupResult>) => {
      if (
        state.status === ReaderStatus.answering ||
        state.status === ReaderStatus.prompting
      ) {
        state.status = ReaderStatus.judged;
        state.currentResult = action.payload;
        state.results.unshift(action.payload);
        state.score += action.payload.score;
      }
    },
    filterTossupsByCategory: (state, action: PayloadAction<Category[]>) => {
      state.tossups = state.tossups.filter((tu) =>
        action.payload.includes(tu.category),
      );
    },
    filterTossupsBySubcategory: (
      state,
      action: PayloadAction<Subcategory[]>,
    ) => {
      state.tossups = state.tossups.filter((tu) =>
        action.payload.includes(tu.subcategory),
      );
    },
    filterTossupsByDifficulties: (
      state,
      action: PayloadAction<Difficulty[]>,
    ) => {
      state.tossups = state.tossups.filter((tu) =>
        action.payload.includes(tu.difficulty),
      );
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchTossups.fulfilled, (state, action) => {
      state.tossups.push(...action.payload);
    });
    builder
      .addCase(nextTossup.pending, (state) => {
        state.status = ReaderStatus.fetching;
      })
      .addCase(nextTossup.fulfilled, (state) => {
        if (state.tossups.length === 0) {
          state.status = ReaderStatus.empty;
        } else {
          state.currentResult = {} as TossupResult;
          state.tossups.shift();
          [state.currentTossup] = state.tossups;
          state.status = ReaderStatus.reading;
        }
      });
  },
});
export const {
  buzz,
  setBuzz,
  prompt,
  submitAnswer,
  filterTossupsByCategory,
  filterTossupsBySubcategory,
  filterTossupsByDifficulties,
} = tossupReaderSlice.actions;

export const selectTossupReader = (state: RootState) => state.tossupReader;

export default tossupReaderSlice.reducer;
