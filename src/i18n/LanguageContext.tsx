/**
 * The one piece of React machinery i18n needs: which language is active,
 * how to change it, and the current dictionary to render from.
 *
 * No auto-detection from `navigator.language` on purpose. This app has no
 * backend to fall back on if that guess is wrong, and a silently-guessed
 * language is exactly the kind of decision CommunityPanel's own header
 * comment warns against making for the owner ("must never be made
 * silently"). Default is a fixed "en"; a person switches explicitly with
 * the sidebar's language control, and that choice is what persists.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { en } from "./en";
import { zh } from "./zh";
import { LANGUAGES, type Language, type Messages } from "./messages";

const DICTIONARIES: Record<Language, Messages> = { en, zh };
const STORAGE_KEY = "vouchd.language";

function isLanguage(value: string): value is Language {
  return (LANGUAGES as string[]).includes(value);
}

function loadLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && isLanguage(stored) ? stored : "en";
  } catch {
    return "en";
  }
}

function rememberLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Same non-issue as CommunityPanel's remembered relay URL: a browser
    // with storage disabled just won't carry the choice across a reload.
  }
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Messages;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(loadLanguage);

  function setLanguage(next: Language): void {
    rememberLanguage(next);
    setLanguageState(next);
  }

  const value = useMemo(() => ({ language, setLanguage, t: DICTIONARIES[language] }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function useLanguageContext(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useT/useLanguage must be used within <LanguageProvider>");
  return context;
}

/** The current language's full dictionary -- what every panel renders from. */
export function useT(): Messages {
  return useLanguageContext().t;
}

/** The current language plus how to change it -- what the switcher renders from. */
export function useLanguage(): Pick<LanguageContextValue, "language" | "setLanguage"> {
  const { language, setLanguage } = useLanguageContext();
  return { language, setLanguage };
}
