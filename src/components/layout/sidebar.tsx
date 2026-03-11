'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useClub } from '@/providers/club-provider';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'Schedule', href: '/schedule', icon: '📅' },
  { label: 'Coaches', href: '/coaches', icon: '🤺' },
  { label: 'My Bookings', href: '/bookings/history', icon: '📋' },
  { label: 'Waitlist', href: '/waitlist', icon: '⏳', roles: ['player'] },
  { label: 'Messages', href: '/messages', icon: '💬' },
  { label: 'Lesson Requests', href: '/lesson-requests', icon: '📝', roles: ['coach', 'admin'] },
  { label: 'Availability', href: '/availability', icon: '🕐', roles: ['coach', 'admin'] },
  { label: 'Earnings', href: '/earnings', icon: '💰', roles: ['coach'] },
];

const adminItems: NavItem[] = [
  { label: 'Members', href: '/admin/members', icon: '👥' },
  { label: 'Venues', href: '/admin/venues', icon: '🏠' },
  { label: 'Lesson Types', href: '/admin/lesson-types', icon: '⚔️' },
  { label: 'Payouts', href: '/admin/payouts', icon: '💳' },
  { label: 'Revenue', href: '/admin/revenue', icon: '📊' },
  { label: 'Disputes', href: '/admin/disputes', icon: '⚖️' },
  { label: 'Settings', href: '/admin/settings', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { club, currentMember, role } = useClub();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  const initials = currentMember?.display_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Club header */}
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">
          {club?.name?.charAt(0) || 'F'}
        </div>
        <div className="flex-1 truncate">
          <div className="text-sm font-semibold truncate">{club?.name || 'Loading...'}</div>
          <div className="text-xs text-sidebar-foreground/60 capitalize">{role}</div>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {filteredNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Admin section */}
        {role === 'admin' && (
          <>
            <Separator className="my-3 bg-sidebar-border" />
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Admin
            </div>
            <div className="space-y-1">
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    pathname === item.href || pathname.startsWith(item.href + '/')
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-2 text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={currentMember?.avatar_url || undefined} />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left truncate">
                <div className="text-sm font-medium truncate">
                  {currentMember?.display_name || 'User'}
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/account">Account Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/notifications">Notifications</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
