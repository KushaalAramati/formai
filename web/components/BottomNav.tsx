'use client';

import { usePathname, useRouter } from 'next/navigation';

const ITEMS = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <path d="M3 11l9-8 9 8M5 10v10h14V10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: '/progress',
    label: 'Progress',
    icon: (
      <path d="M4 19V5M4 19h16M8 15l3-3 3 2 4-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: '/history',
    label: 'History',
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </g>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21v-1a7 7 0 0114 0v1" />
      </g>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <nav className="bottomnav" aria-label="Primary">
      <div className="inner">
        {ITEMS.map((it) => {
          const active = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href);
          return (
            <button
              key={it.href}
              className={`navitem ${active ? 'on' : ''}`}
              onClick={() => router.push(it.href)}
              aria-label={it.label}
              aria-current={active ? 'page' : undefined}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {it.icon}
              </svg>
              {it.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
