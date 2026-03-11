'use client';

import { useState } from 'react';

export function TryDemoButton() {
  const [loading, setLoading] = useState(false);

  const startDemo = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/demo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      });
      if (res.ok) {
        window.location.href = '/dashboard';
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={startDemo}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-md border-2 border-primary bg-primary/5 px-8 py-3 text-base font-medium text-primary hover:bg-primary/10 transition-colors w-full sm:w-auto disabled:opacity-50"
    >
      {loading ? 'Loading Demo...' : 'Try Demo'}
    </button>
  );
}
