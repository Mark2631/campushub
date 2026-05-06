'use client';

import { useAppContext } from '../components/AppProvider';

export default function useTheme() {
  const { theme, toggleTheme } = useAppContext();
  return { theme, toggleTheme };
}
