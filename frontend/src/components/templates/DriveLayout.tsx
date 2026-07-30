import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, useOutletContext, useNavigate } from 'react-router-dom';
import {
  AppSidebar,
  type StorageBreakdown,
  type StorageSummary,
} from '@/components/organisms/AppSidebar';
import { AppHeader } from '@/components/organisms/AppHeader';
import { UploadProgressPanel } from '@/components/organisms/UploadProgressPanel';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/lib/api';
import { clearAuthSession, getStoredUser, updateStoredUser, type AuthUser } from '@/lib/auth';
import { getStoredSidebarCollapsed, setStoredSidebarCollapsed } from '@/lib/sidebar-storage';

export type DriveLayoutContext = {
  setHeaderActions: (actions: ReactNode) => void;
};

export function useDriveLayoutActions() {
  return useOutletContext<DriveLayoutContext>();
}

/** Shell for every authenticated route: sidebar, header, outlet, upload panel. */
export function DriveLayout() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [storage, setStorage] = useState<StorageSummary | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdown>({
    photo: '0',
    video: '0',
    document: '0',
  });
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => !getStoredSidebarCollapsed());

  async function loadSidebarStats() {
    await Promise.all([
      apiFetch<StorageSummary>('/storage/summary').then(setStorage),
      apiFetch<StorageBreakdown>('/storage/breakdown').then(setBreakdown),
    ]);
  }

  useEffect(() => {
    apiFetch<{ user: AuthUser }>('/auth/me')
      .then((data) => {
        setUser(data.user);
        updateStoredUser(data.user);
      })
      .catch(() => undefined);
    loadSidebarStats().catch(() => undefined);
    // Pages dispatch this after any mutation that changes bytes on disk.
    window.addEventListener('ithaca:storage-changed', loadSidebarStats);
    return () => window.removeEventListener('ithaca:storage-changed', loadSidebarStats);
  }, []);

  async function logout() {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearAuthSession();
    navigate('/login');
  }

  return (
    <SidebarProvider
      open={sidebarExpanded}
      onOpenChange={(open) => {
        setSidebarExpanded(open);
        setStoredSidebarCollapsed(!open);
      }}
    >
      <main className="min-h-screen w-full overflow-x-hidden bg-background">
        <div className="flex min-h-screen w-full flex-col bg-background lg:h-screen lg:overflow-hidden lg:flex-row">
          <AppSidebar user={user} storage={storage} breakdown={breakdown} onLogout={logout} />
          <section className="min-w-0 flex-1 p-4 sm:p-6 lg:h-screen lg:overflow-y-auto lg:p-8">
            <AppHeader
              storage={storage}
              theme={theme}
              onToggleTheme={toggleTheme}
              headerActions={headerActions}
            />
            <Outlet context={{ setHeaderActions } satisfies DriveLayoutContext} />
          </section>
        </div>

        <UploadProgressPanel />
      </main>
    </SidebarProvider>
  );
}
