import { ClubProvider } from '@/providers/club-provider';
import { QueryProvider } from '@/providers/query-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { ViewAsBar } from '@/components/layout/view-as-bar';

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ClubProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <ViewAsBar />
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar — hidden on mobile, visible on lg+ */}
            <div className="hidden lg:flex">
              <Sidebar />
            </div>

            {/* Main content area */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <Topbar />
              <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                {children}
              </main>
            </div>
          </div>
        </div>
      </ClubProvider>
    </QueryProvider>
  );
}
