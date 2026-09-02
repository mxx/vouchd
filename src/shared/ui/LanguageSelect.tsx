/**
 * The language picker, rendered next to the page title (App.tsx) rather
 * than tucked into the sidebar footer -- it's a per-session choice about
 * the whole page, not an identity/account fact, so it reads better beside
 * the title than beside the NIP-07 chip.
 *
 * A `<select>`, not a row of buttons: `LANGUAGES` (src/i18n/messages.ts) is
 * meant to grow past two, and a button per language stops fitting this
 * header long before a dropdown does.
 */

import type { Language } from "../../i18n";
import { LANGUAGES, LANGUAGE_LABELS, useLanguage, useT } from "../../i18n";

function isLanguage(value: string): value is Language {
  return (LANGUAGES as string[]).includes(value);
}

export function LanguageSelect() {
  const { language, setLanguage } = useLanguage();
  const t = useT();
  return (
    <select
      aria-label={t.nav.languageLabel}
      className="lang-select"
      onChange={(event) => {
        if (isLanguage(event.target.value)) setLanguage(event.target.value);
      }}
      value={language}
    >
      {LANGUAGES.map((code) => (
        <option key={code} value={code}>
          {LANGUAGE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}
