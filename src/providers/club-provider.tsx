'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Club, ClubMember, UserRole } from '@/types';

interface ClubContextValue {
  club: Club | null;
  currentMember: ClubMember | null;
  role: UserRole | null;
  actualRole: UserRole | null;
  simulatedRole: UserRole | null;
  setSimulatedRole: (role: UserRole | null) => void;
  isDemo: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const ClubContext = createContext<ClubContextValue>({
  club: null,
  currentMember: null,
  role: null,
  actualRole: null,
  simulatedRole: null,
  setSimulatedRole: () => {},
  isDemo: false,
  isLoading: true,
  refetch: async () => {},
});

export function ClubProvider({ children }: { children: ReactNode }) {
  const [club, setClub] = useState<Club | null>(null);
  const [currentMember, setCurrentMember] = useState<ClubMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const fetchClubData = async () => {
    // Fetch club context via API route (handles both auth and demo mode server-side)
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        if (data.member) setCurrentMember(data.member as ClubMember);
        if (data.club) setClub(data.club as Club);
        if (data.isDemo) setIsDemo(true);
      }
    } catch {
      // Silently fail — pages will show empty state
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClubData();
  }, []);

  const actualRole = (currentMember?.role as UserRole) || null;
  const effectiveRole = (simulatedRole && actualRole === 'admin') ? simulatedRole : actualRole;

  return (
    <ClubContext.Provider
      value={{
        club,
        currentMember,
        role: effectiveRole,
        actualRole,
        simulatedRole,
        setSimulatedRole,
        isDemo,
        isLoading,
        refetch: fetchClubData,
      }}
    >
      {children}
    </ClubContext.Provider>
  );
}

export function useClub() {
  const context = useContext(ClubContext);
  if (!context) {
    throw new Error('useClub must be used within a ClubProvider');
  }
  return context;
}
