import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { translations } from "../i18n/translations";

const LANGUAGE_KEY = "app_language";
const DEFAULT_LANGUAGE = "id";

const LanguageContext = createContext(null);

function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return saved === "id" || saved === "en" ? saved : DEFAULT_LANGUAGE;
  });

  const setLanguage = (nextLanguage) => {
    if (nextLanguage !== "en" && nextLanguage !== "id") return;
    setLanguageState(nextLanguage);
    localStorage.setItem(LANGUAGE_KEY, nextLanguage);
  };

  const t = useCallback((key) => {
    const current = getByPath(translations[language], key);
    if (current !== undefined) return current;
    const fallback = getByPath(translations[DEFAULT_LANGUAGE], key);
    return fallback !== undefined ? fallback : key;
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return ctx;
}
