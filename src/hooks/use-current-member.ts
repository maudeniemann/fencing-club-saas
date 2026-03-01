'use client';

import { useClub } from '@/providers/club-provider';
import type { UserRole } from '@/types';

export function useCurrentMember() {
  const { currentMember, role, isLoading } = useClub();
  return { currentMember, role, isLoading };
}

export function useRequireRole(...allowedRoles: UserRole[]) {
  const { role, isLoading } = useCurrentMember();
  const hasAccess = role !== null && allowedRoles.includes(role);
  return { hasAccess, role, isLoading };
}
