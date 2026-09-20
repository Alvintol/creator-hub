import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  acceptOfferedCategories,
  noOptionalCategories,
  optionalCookieCategoryInfo,
  type CookieCategoryChoices,
} from "../../domain/legal/cookiePreferences";
import { useCookiePreferences } from "../../providers/CookiePreferencesProvider";

const classes = {
  banner:
    "fixed inset-x-0 bottom-0 z-40 border-t border-[var(--hairline)] bg-[rgb(var(--surface))] px-4 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] sm:px-6",
  bannerInner: "container mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
  text: "text-sm leading-6 text-zinc-600",
  link: "font-semibold underline underline-offset-2",
  // All choice buttons share one style so none is visually favoured.
  choices: "flex flex-wrap gap-2",
  choice: "btnOutline",
  backdrop: "fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center",
  dialog: "card max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-6",
  title: "font-display text-lg font-extrabold tracking-tight",
  section: "space-y-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3",
  sectionTitle: "text-sm font-bold text-zinc-900",
  toggleRow: "flex gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3",
  checkbox: "mt-1 h-4 w-4 shrink-0 rounded border-zinc-300",
} as const;

const CookieSettingsDialog = () => {
  const { preferences, activeCategories, closeSettings, saveChoices } =
    useCookiePreferences();

  const [choices, setChoices] = useState<CookieCategoryChoices>(() =>
    preferences
      ? { ...noOptionalCategories, ...preferences.categories }
      : noOptionalCategories,
  );

  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSettings();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [closeSettings]);

  const activeInfo = optionalCookieCategoryInfo.filter((info) =>
    activeCategories.includes(info.key),
  );

  return (
    <div className={classes.backdrop}>
      <div
        className={classes.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-settings-title"
      >
        <h2 id="cookie-settings-title" ref={titleRef} tabIndex={-1} className={classes.title}>
          Cookie settings
        </h2>

        <div className={classes.section}>
          <p className={classes.sectionTitle}>Necessary (always on)</p>
          <p className={classes.text}>
            Keeps you signed in, processes payments you ask for, and remembers
            the choices you make here.
          </p>
        </div>

        {activeInfo.length === 0 ? (
          <p className={classes.text}>
            Made for Stream doesn&rsquo;t use any optional cookies or similar
            technologies right now, so there is nothing to turn on. If that
            changes, we&rsquo;ll ask you first.
          </p>
        ) : (
          activeInfo.map((info) => {
            const inputId = `cookie-category-${info.key}`;

            return (
              <label key={info.key} className={classes.toggleRow} htmlFor={inputId}>
                <input
                  id={inputId}
                  className={classes.checkbox}
                  type="checkbox"
                  checked={choices[info.key]}
                  onChange={(event) =>
                    setChoices((current) => ({
                      ...current,
                      [info.key]: event.currentTarget.checked,
                    }))
                  }
                />
                <span>
                  <span className={classes.sectionTitle}>{info.label}</span>
                  <span className={`${classes.text} block`}>{info.description}</span>
                </span>
              </label>
            );
          })
        )}

        <p className={classes.text}>
          Read the{" "}
          <Link className={classes.link} to="/policies/cookies" onClick={closeSettings}>
            Cookie Policy
          </Link>{" "}
          for details.
        </p>

        <div className={classes.choices}>
          {activeInfo.length > 0 && (
            <>
              <button
                className={classes.choice}
                type="button"
                onClick={() => saveChoices(noOptionalCategories)}
              >
                Reject optional
              </button>
              <button
                className={classes.choice}
                type="button"
                onClick={() => saveChoices(acceptOfferedCategories(activeCategories))}
              >
                Accept optional
              </button>
              <button
                className={classes.choice}
                type="button"
                onClick={() => saveChoices(choices)}
              >
                Save choices
              </button>
            </>
          )}
          <button className={classes.choice} type="button" onClick={closeSettings}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Asks for a choice only while an optional category is active, and hosts the
// "Cookie settings" dialog, which can be reopened from the footer at any time
// (Cookie Policy section 4).
const CookieConsent = () => {
  const { activeCategories, needsChoice, settingsOpen, openSettings, saveChoices } =
    useCookiePreferences();

  return (
    <>
      {needsChoice && !settingsOpen && (
        <section className={classes.banner} aria-label="Cookie choices">
          <div className={classes.bannerInner}>
            <p className={classes.text}>
              We&rsquo;d like to use optional cookies and similar technologies.
              They stay off unless you choose otherwise. See our{" "}
              <Link className={classes.link} to="/policies/cookies">
                Cookie Policy
              </Link>
              .
            </p>

            <div className={classes.choices}>
              <button
                className={classes.choice}
                type="button"
                onClick={() => saveChoices(noOptionalCategories)}
              >
                Reject optional
              </button>
              <button
                className={classes.choice}
                type="button"
                onClick={() => saveChoices(acceptOfferedCategories(activeCategories))}
              >
                Accept optional
              </button>
              <button className={classes.choice} type="button" onClick={openSettings}>
                Manage choices
              </button>
            </div>
          </div>
        </section>
      )}

      {settingsOpen && <CookieSettingsDialog />}
    </>
  );
};

export default CookieConsent;
