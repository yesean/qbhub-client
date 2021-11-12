import { createContext } from 'react';
import { TossupResult } from '../types/tossupReader';

export type TossupResultContextType = {
  result: TossupResult | null;
  setResult: React.Dispatch<React.SetStateAction<TossupResult | null>>;
};

export const TossupResultContext = createContext<TossupResultContextType>({
  result: null,
  setResult: () => {},
});
