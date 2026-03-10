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
  isLoading: true,
  refetch: async () => {},
});

export function ClubProvider({ children }: { children: ReactNode }) {
  const [club, setClub] = useState<Club | null>(null);
  const [currentMember, setCurrentMember] = useState<ClubMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);

  const fetchClubData = async () => {
    // Fetch club context via API route (handles both auth and demo mode server-side)
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const { member, club: clubData } = await res.json();
        if (member) setCurrentMember(member as ClubMember);
        if (clubData) setClub(clubData as Club);
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
