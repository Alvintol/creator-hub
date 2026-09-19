import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  activeOptionalCookieCategories,
  createCookiePreferences,
  hasCookieConsent,
  needsCookieChoice,
  type CookieCategoryChoices,
  type CookiePreferences,
  type OptionalCookieCategory,
} from "../domain/legal/cookiePreferences";
import {
  readCookiePreferences,
  writeCookiePreferences,
} from "../lib/legal/cookiePreferencesStorage";

type CookiePreferencesContextValue = {
  preferences: CookiePreferences | null;
  activeCategories: OptionalCookieCategory[];
  needsChoice: boolean;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  saveChoices: (choices: CookieCategoryChoices) => void;
  hasConsent: (category: OptionalCookieCategory) => boolean;
};

const CookiePreferencesContext =
  createContext<CookiePreferencesContextValue | null>(null);

type CookiePreferencesProviderProps = {
  children: ReactNode;
  // Overridable for tests; the app uses the list in the domain module.
  activeCategories?: OptionalCookieCategory[];
};

const CookiePreferencesProvider = (props: CookiePreferencesProviderProps) => {
  const { children, activeCategories = activeOptionalCookieCategories } = props;

  const [preferences, setPreferences] = useState<CookiePreferences | null>(() =>
    readCookiePreferences(),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const saveChoices = useCallback(
    (choices: CookieCategoryChoices) => {
      const next = createCookiePreferences(choices, activeCategories);

      writeCookiePreferences(next);
      setPreferences(next);
      setSettingsOpen(false);
    },
    [activeCategories],
  );

  const hasConsent = useCallback(
    (category: OptionalCookieCategory) =>
      activeCategories.includes(category) && hasCookieConsent(preferences, category),
    [activeCategories, preferences],
  );

  const value = useMemo<CookiePreferencesContextValue>(
    () => ({
      preferences,
      activeCategories,
      needsChoice: needsCookieChoice(preferences, activeCategories),
      settingsOpen,
      openSettings,
      closeSettings,
      saveChoices,
      hasConsent,
    }),
    [
      preferences,
      activeCategories,
      settingsOpen,
      openSettings,
      closeSettings,
      saveChoices,
      hasConsent,
    ],
  );

  return (
    <CookiePreferencesContext.Provider value={value}>
      {children}
    </CookiePreferencesContext.Provider>
  );
};

export const useCookiePreferences = () => {
  const value = useContext(CookiePreferencesContext);

  if (!value) {
    throw new Error("useCookiePreferences must be used within CookiePreferencesProvider");
  }

  return value;
};

export default CookiePreferencesProvider;
