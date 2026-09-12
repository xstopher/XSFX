import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { store } from '../lib/store';

const NAV = [
  {
    to: '/',
    label: 'Calculator',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1.5" y="1.5" width="6" height="6" stroke={active ? '#c4a25a' : '#6a6a7e'} strokeWidth="1.2"/>
        <rect x="10.5" y="1.5" width="6" height="6" stroke={active ? '#c4a25a' : '#6a6a7e'} strokeWidth="1.2"/>
        <rect x="1.5" y="10.5" width="6" height="6" stroke={active ? '#c4a25a' : '#6a6a7e'} strokeWidth="1.2"/>
        <path d="M10.5 13.5H16.5M13.5 10.5V16.5" stroke={active ? '#c4a25a' : '#6a6a7e'} strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    to: '/journal',
    label: 'Journal',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="1.5" width="14" height="15" stroke={active ? '#c4a25a' : '#6a6a7e'} strokeWidth="1.2"/>
        <path d="M5 6H13M5 9H13M5 12H10" stroke={active ? '#c4a25a' : '#6a6a7e'} strokeWidth="1.2" strokeLinecap="square"/>
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="2.5" stroke={active ? '#c4a25a' : '#6a6a7e'} strokeWidth="1.2"/>
        <path d="M9 1.5V3M9 15V16.5M1.5 9H3M15 9H16.5M3.697 3.697L4.757 4.757M13.243 13.243L14.303 14.303M3.697 14.303L4.757 13.243M13.243 4.757L14.303 3.697" stroke={active ? '#c4a25a' : '#6a6a7e'} strokeWidth="1.2" strokeLinecap="square"/>
      </svg>
    ),
  },
];

export default function Shell() {
  const loc = useLocation();

  useEffect(() => { void store.hydrate(); }, []);

  return (
    <div className="flex flex-col lg:flex-row h-dvh overflow-hidden bg-[#09090c]">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-[200px] xl:w-[220px] flex-shrink-0 bg-[#07070a] border-r border-[#1f1f2a]">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#1f1f2a]">
          <div className="flex items-center gap-2.5">
            <div className="relative w-5 h-5 flex-shrink-0">
              <div className="absolute inset-0 border border-[#c4a25a]/50" />
              <div className="absolute inset-[3px] bg-[#c4a25a]/20" />
              <div className="absolute inset-[6px] bg-[#c4a25a]" />
            </div>
            <span className="font-mono text-[11px] tracking-widest text-[#e0dfd8] uppercase select-none">
              PositionCalc
            </span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col pt-3 flex-1">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm transition-colors relative
                 ${isActive ? 'text-[#e0dfd8]' : 'text-[#6a6a7e] hover:text-[#aaa]'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#c4a25a]" />
                  )}
                  {item.icon(isActive)}
                  <span className={`text-xs tracking-wider uppercase ${isActive ? '' : ''}`}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#1f1f2a]">
          <p className="font-mono text-[10px] text-[#38384a]">v1.0.0</p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col pb-16 lg:pb-0">
        <Outlet />
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-[#07070a] border-t border-[#1f1f2a] flex z-50">
        {NAV.map(item => {
          const isActive = item.to === '/'
            ? loc.pathname === '/'
            : loc.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 relative"
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-[#c4a25a]" />
              )}
              {item.icon(isActive)}
              <span className={`font-mono text-[9px] tracking-widest uppercase ${isActive ? 'text-[#c4a25a]' : 'text-[#6a6a7e]'}`}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
