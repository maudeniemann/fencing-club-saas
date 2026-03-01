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
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsLoading(false);
      return;
    }

    // Get current member (with club_id)
    const { data: member } = await supabase
      .from('club_members')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!member) {
      setIsLoading(false);
      return;
    }

    setCurrentMember(member as ClubMember);

    // Get club details
    const { data: clubData } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', member.club_id)
      .single();

    if (clubData) {
      setClub(clubData as Club);
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
