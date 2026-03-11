'use client';

import { useState } from 'react';
import { useClub } from '@/providers/club-provider';

const ROLES = [
  { key: 'admin', label: 'Admin', icon: '🏠' },
  { key: 'coach', label: 'Coach', icon: '🤺' },
  { key: 'player', label: 'Player', icon: '👤' },
] as const;

export function DemoRoleSwitcher() {
  const { isDemo, role } = useClub();
  const [switching, setSwitching] = useState(false);

  if (!isDemo) return null;

  const switchRole = async (newRole: string) => {
    if (newRole === role || switching) return;
    setSwitching(true);
    try {
      const res = await fetch('/api/demo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        window.location.href = '/dashboard';
      }
    } finally {
      setSwitching(false);
    }
  };

  const exitDemo = async () => {
    setSwitching(true);
    try {
      await fetch('/api/demo/end', { method: 'POST' });
      window.location.href = '/';
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-border bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur">
      <span className="px-2 text-xs font-medium text-muted-foreground">Demo</span>
      <div className="flex gap-0.5">
        {ROLES.map((r) => (
          <button
            key={r.key}
            onClick={() => switchRole(r.key)}
            disabled={switching}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              role === r.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <span>{r.icon}</span>
            {r.label}
          </button>
        ))}
      </div>
      <div className="mx-1 h-4 w-px bg-border" />
      <button
        onClick={exitDemo}
        disabled={switching}
        className="rounded-full px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
      >
        Exit
      </button>
    </div>
  );
}
