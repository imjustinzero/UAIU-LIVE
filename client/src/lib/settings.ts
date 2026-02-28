import { createContext, useContext, useState, useEffect, ReactNode, createElement } from "react";

export type FontSize = 'normal' | 'large' | 'x-large';

interface Settings {
  fontSize: FontSize;
  highContrast: boolean;
  setFontSize: (size: FontSize) => void;
  setHighContrast: (enabled: boolean) => void;
}

const SettingsContext = createContext<Settings>({
  fontSize: 'normal',
  highContrast: false,
  setFontSize: () => {},
  setHighContrast: () => {},
});

const STORAGE_KEY = 'uaiu-a11y-settings';

function loadSettings(): { fontSize: FontSize; highContrast: boolean } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { fontSize: 'normal', highContrast: false };
}

function applyToDocument(fontSize: FontSize, highContrast: boolean) {
  const root = document.documentElement;
  root.classList.remove('text-lg', 'text-xl');
  if (fontSize === 'large') root.classList.add('text-lg');
  if (fontSize === 'x-large') root.classList.add('text-xl');
  if (highContrast) {
    root.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const initial = loadSettings();
  const [fontSize, setFontSizeState] = useState<FontSize>(initial.fontSize);
  const [highContrast, setHighContrastState] = useState(initial.highContrast);

  useEffect(() => {
    applyToDocument(fontSize, highContrast);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ fontSize, highContrast }));
    } catch {}
  }, [fontSize, highContrast]);

  useEffect(() => {
    applyToDocument(initial.fontSize, initial.highContrast);
  }, []);

  const setFontSize = (size: FontSize) => setFontSizeState(size);
  const setHighContrast = (enabled: boolean) => setHighContrastState(enabled);

  return createElement(SettingsContext.Provider, { value: { fontSize, highContrast, setFontSize, setHighContrast } }, children);
}

export function useSettings() {
  return useContext(SettingsContext);
}
