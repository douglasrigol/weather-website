import type { ReactNode } from 'react';
import type { Unit } from '../types';

export type View = 'painel' | 'globo';

interface Props {
  view: View;
  onViewChange: (view: View) => void;
  unit: Unit;
  onUnitChange: (unit: Unit) => void;
}

const NAV: Array<{ id: View; label: string; icon: ReactNode }> = [
  {
    id: 'painel',
    label: 'Painel',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor" />
        <rect x="13" y="4" width="7" height="7" rx="2" fill="currentColor" opacity="0.55" />
        <rect x="4" y="13" width="7" height="7" rx="2" fill="currentColor" opacity="0.55" />
        <rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'globo',
    label: 'Globo',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <ellipse cx="12" cy="12" rx="3.8" ry="8.5" />
        <path d="M3.5 12h17M5 7.5h14M5 16.5h14" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function Sidebar({ view, onViewChange, unit, onUnitChange }: Props) {
  return (
    <nav className="sidebar glass" aria-label="Navegação principal">
      <a className="sidebar__logo" href="/" aria-label="Nimbo, página inicial">
        <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
          <path
            d="M5 12c3-3 6-3 9 0s6 3 9 0 4-2 4-2M5 17c3-3 6-3 9 0s6 3 9 0 4-2 4-2M5 22c3-3 6-3 9 0s6 3 9 0 4-2 4-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </a>

      <ul className="sidebar__nav">
        {NAV.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="sidebar__item"
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => onViewChange(item.id)}
            >
              {item.icon}
              <span className="sidebar__label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="units" role="radiogroup" aria-label="Unidade de temperatura">
        {(['c', 'f'] as const).map((u) => (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={unit === u}
            className="units__option"
            onClick={() => onUnitChange(u)}
          >
            °{u.toUpperCase()}
          </button>
        ))}
      </div>
    </nav>
  );
}
