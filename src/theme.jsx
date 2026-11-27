import { useEffect, useLayoutEffect, useState } from 'react';
import { Moon } from 'lucide-react';

const preferenceKey = 'kelola:theme';
const systemColorScheme = '(prefers-color-scheme: dark)';

function readPreference() {
  try {
    const stored = localStorage.getItem(preferenceKey);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return 'system';
}

export function useThemePreference() {
  const [preference, setPreference] = useState(readPreference);

  useLayoutEffect(() => {
    const system = matchMedia(systemColorScheme);
    const apply = () => {
      const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
      document.documentElement.dataset.theme = theme;
      const browserColor = document.querySelector('meta[name="theme-color"]');
      browserColor.content = browserColor.dataset[theme];
    };
    apply();
    if (preference !== 'system') return undefined;
    system.addEventListener('change', apply);
    return () => system.removeEventListener('change', apply);
  }, [preference]);

  useEffect(() => {
    const sync = event => {
      if (event.key === preferenceKey || event.key === null) setPreference(readPreference());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  function changeTheme(next) {
    setPreference(next);
    try { localStorage.setItem(preferenceKey, next); } catch {}
  }

  return { preference, changeTheme };
}

export function ThemeControl({ preference, changeTheme }) {
  return <label className="theme-control">
    <span><Moon size={15} aria-hidden="true" />Tema tampilan</span>
    <select value={preference} onChange={event => changeTheme(event.target.value)}>
      <option value="system">Sistem</option>
      <option value="light">Terang</option>
      <option value="dark">Gelap</option>
    </select>
  </label>;
}
