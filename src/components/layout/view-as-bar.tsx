'use client';

import { useClub } from '@/providers/club-provider';
import { Button } from '@/components/ui/button';
import type { UserRole } from '@/types';

const roles: { value: UserRole | null; label: string }[] = [
  { value: null, label: 'Admin' },
  { value: 'player', label: 'Player' },
  { value: 'coach', label: 'Coach' },
  { value: 'parent', label: 'Parent' },
];

export function ViewAsBar() {
  const { actualRole, simulatedRole, setSimulatedRole } = useClub();

  if (actualRole !== 'admin') return null;

  const isSimulating = simulatedRole !== null;

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 text-sm border-b transition-colors ${
        isSimulating
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-card border-border text-foreground'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium whitespace-nowrap">
          {isSimulating ? (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2 animate-pulse" />
              Simulating: <span className="font-semibold capitalize">{simulatedRole}</span> View
            </>
          ) : (
            'View as:'
          )}
        </span>
        <div className="flex items-center gap-1">
          {roles.map(({ value, label }) => {
            const isActive = simulatedRole === value;
            return (
              <Button
                key={label}
                size="sm"
                variant={isActive ? 'default' : 'ghost'}
                className={`h-7 px-3 text-xs font-medium ${
                  isActive ? '' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setSimulatedRole(value)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {isSimulating && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-3 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
          onClick={() => setSimulatedRole(null)}
        >
          Exit Simulation
        </Button>
      )}
    </div>
  );
}
