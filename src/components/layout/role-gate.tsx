'use client';

import { useRequireRole } from '@/hooks/use-current-member';
import type { UserRole } from '@/types';
import type { ReactNode } from 'react';

interface RoleGateProps {
  allowedRoles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGate({ allowedRoles, children, fallback = null }: RoleGateProps) {
  const { hasAccess, isLoading } = useRequireRole(...allowedRoles);

  if (isLoading) return null;
  if (!hasAccess) return <>{fallback}</>;
  return <>{children}</>;
}
