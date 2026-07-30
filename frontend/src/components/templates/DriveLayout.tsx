import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import {
  Outlet,
  useOutletContext,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  Bell,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  X,
  ShieldCheck,
  HardDrive,
  Info,
  CheckCircle,
  ChevronDown,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  AppSidebar,
  type StorageBreakdown,
  type StorageSummary,
} from '@/components/organisms/AppSidebar';
import { BrandLogo } from '@/components/atoms/BrandLogo';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { getStoredSidebarCollapsed, setStoredSidebarCollapsed } from '@/lib/sidebar-storage';
import { Input } from '@/components/ui/input';
import { apiFetch, formatBytes } from '@/lib/api';
import { useUpload } from '@/context/UploadContext';
import { clearAuthSession, getStoredUser, updateStoredUser, type AuthUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

function SystemInfoDropdown({ storage }: { storage: any }) {
  const activeGoogle =
    storage?.accounts?.filter(
      (a: any) => a.provider === 'google_drive' && a.status === 'connected',
    ) ?? [];

  return (
    <div className="absolute right-0 top-12 z-50 w-[min(calc(100vw-2rem),22rem)] overflow-hidden rounded-sm border border-border bg-card shadow-2xl shadow-slate-950/15">
      <div className="border-b border-border px-4 py-3 bg-muted">
        <p className="text-sm font-extrabold text-foreground">Workspace Status & Info</p>
        <p className="text-xs text-muted-foreground">Overview of your connections & guidelines</p>
      </div>
      <div className="max-h-96 overflow-y-auto p-4 space-y-4">
        {/* Connection status */}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Connection Status
          </h4>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between text-xs rounded-sm bg-muted p-2.5 border border-border">
              <span className="font-semibold text-foreground">Google Drive accounts</span>
              <span
                className={
                  activeGoogle.length > 0
                    ? 'text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold border border-emerald-100'
                    : 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-bold border border-amber-100'
                }
              >
                {activeGoogle.length} Connected
              </span>
            </div>
            {activeGoogle.map((acc: any) => (
              <p key={acc.id} className="text-[11px] text-muted-foreground truncate px-2.5">
                — {acc.email}
              </p>
            ))}
          </div>
        </div>

        {/* Database & engine status */}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5 text-blue-500" /> Storage Engine
          </h4>
          <div className="mt-2 text-xs text-muted-foreground space-y-1 bg-muted p-2.5 rounded-sm border border-border">
            <p>
              • <b>DB Type:</b> SQLite (Local Database)
            </p>
            <p>
              • <b>Upload Folder:</b> Google Drive dedicated <code>Ithaca</code>
            </p>
            <p>
              • <b>Max Upload Size:</b> 5 GB per stream
            </p>
          </div>
        </div>

        {/* Tips & Guides */}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-indigo-500" /> Usage Tips
          </h4>
          <ul className="mt-2 text-[11px] text-muted-foreground list-disc list-inside space-y-1 pl-1">
            <li>Virtual folders exist only in your SQLite database.</li>
            <li>Physical files are always uploaded straight to Google Drive.</li>
            <li>Use the Sync button to fetch changes made directly on Drive.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

type ConnectedAccount = {
  id: string;
  email: string;
  provider: string;
};

export type DriveLayoutContext = {
  setHeaderActions: (actions: ReactNode) => void;
};

export function useDriveLayoutActions() {
  return useOutletContext<DriveLayoutContext>();
}

export function DriveLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '');
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [storage, setStorage] = useState<StorageSummary | null>(null);
  const [breakdown, setBreakdown] = useState<StorageBreakdown>({
    photo: '0',
    video: '0',
    document: '0',
  });
  const [infoOpen, setInfoOpen] = useState(false);
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);
  const { uploadProgress, setUploadProgress, retryFailedUpload } = useUpload();
  const [uploadProgressCollapsed, setUploadProgressCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ithaca:theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });
  const [sidebarExpanded, setSidebarExpanded] = useState(() => !getStoredSidebarCollapsed());

  // Advanced search states
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterKind, setFilterKind] = useState(searchParams.get('kind') ?? '');
  const [filterAccountId, setFilterAccountId] = useState(searchParams.get('accountId') ?? '');
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const raw = searchParams.get('startDate');
    return raw ? raw.split('T')[0] : '';
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    const raw = searchParams.get('endDate');
    return raw ? raw.split('T')[0] : '';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('ithaca:theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }

  async function loadSidebarStats() {
    await Promise.all([
      apiFetch<StorageSummary>('/storage/summary').then(setStorage),
      apiFetch<StorageBreakdown>('/storage/breakdown').then(setBreakdown),
    ]);
  }

  async function loadConnectedAccounts() {
    try {
      const data = await apiFetch<{ accounts: ConnectedAccount[] }>('/connected-accounts');
      setAccounts(data.accounts);
    } catch (e) {
      console.error('Failed to load accounts for filter dropdown', e);
    }
  }

  useEffect(() => {
    setSearchValue(searchParams.get('q') ?? '');
    setFilterKind(searchParams.get('kind') ?? '');
    setFilterAccountId(searchParams.get('accountId') ?? '');

    const rawStart = searchParams.get('startDate');
    setFilterStartDate(rawStart ? rawStart.split('T')[0] : '');

    const rawEnd = searchParams.get('endDate');
    setFilterEndDate(rawEnd ? rawEnd.split('T')[0] : '');
  }, [searchParams]);

  async function logout() {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearAuthSession();
    navigate('/login');
  }

  function applyFilters() {
    const nextParams = new URLSearchParams();
    const activeFolderId = searchParams.get('folderId');
    if (activeFolderId && location.pathname === '/all-files') {
      nextParams.set('folderId', activeFolderId);
    }

    const q = searchValue.trim();
    if (q) nextParams.set('q', q);

    if (filterKind) nextParams.set('kind', filterKind);
    if (filterAccountId) nextParams.set('accountId', filterAccountId);

    if (filterStartDate) {
      nextParams.set('startDate', new Date(filterStartDate).toISOString());
    }
    if (filterEndDate) {
      nextParams.set('endDate', new Date(filterEndDate).toISOString());
    }

    setFiltersOpen(false);
    navigate({ pathname: '/all-files', search: nextParams.toString() });
  }

  function clearFilters() {
    setFilterKind('');
    setFilterAccountId('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFiltersOpen(false);

    const nextParams = new URLSearchParams();
    const activeFolderId = searchParams.get('folderId');
    if (activeFolderId && location.pathname === '/all-files') {
      nextParams.set('folderId', activeFolderId);
    }
    const q = searchValue.trim();
    if (q) nextParams.set('q', q);

    navigate({ pathname: '/all-files', search: nextParams.toString() });
  }

  function searchFiles(event: FormEvent) {
    event.preventDefault();
    applyFilters();
  }

  useEffect(() => {
    apiFetch<{ user: AuthUser }>('/auth/me')
      .then((data) => {
        setUser(data.user);
        updateStoredUser(data.user);
      })
      .catch(() => undefined);
    loadSidebarStats().catch(() => undefined);
    loadConnectedAccounts().catch(() => undefined);
    window.addEventListener('ithaca:storage-changed', loadSidebarStats);
    return () => window.removeEventListener('ithaca:storage-changed', loadSidebarStats);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setInfoOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
            <header className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center justify-between gap-3 lg:hidden">
                <div className="flex min-w-0 items-center gap-3">
                  <SidebarTrigger variant="outline" size="icon" aria-label="Open sidebar" />
                  <div className="flex min-w-0 items-center gap-2">
                    <BrandLogo className="h-9 w-9 shrink-0" />
                    <span className="truncate text-xl font-extrabold tracking-tight">Ithaca</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Toggle theme"
                    onClick={toggleTheme}
                  >
                    {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  </Button>
                  <div className="relative shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="relative"
                      aria-label="System info"
                      aria-expanded={infoOpen}
                      onClick={() => setInfoOpen(!infoOpen)}
                    >
                      <Bell className="h-5 w-5" />
                      {!infoOpen ? (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                      ) : null}
                    </Button>
                    {infoOpen ? <SystemInfoDropdown storage={storage} /> : null}
                  </div>
                </div>
              </div>
              <div className="relative w-full min-w-0 flex-1 lg:max-w-sm xl:max-w-xl">
                <form onSubmit={searchFiles} className="relative w-full">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Search Documents"
                    className="pl-7 pr-7"
                  />
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    className={cn(
                      'absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors',
                      filtersOpen && 'text-primary hover:text-primary',
                    )}
                    aria-label="Search filters"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </button>
                </form>

                {filtersOpen && (
                  <div className="absolute left-0 right-0 top-12 z-50 rounded-sm border border-border bg-card p-5 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <span className="text-sm font-extrabold text-foreground">
                        Advanced Search Filters
                      </span>
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-xs font-bold text-primary hover:text-primary"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {/* File Kind */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          File Type
                        </label>
                        <Combobox
                          className="mt-1"
                          searchable={false}
                          value={filterKind}
                          onValueChange={(kind) => setFilterKind(kind)}
                          options={[
                            { value: '', label: 'All Types' },
                            { value: 'image', label: 'Image' },
                            { value: 'video', label: 'Video' },
                            { value: 'pdf', label: 'PDF' },
                            { value: 'doc', label: 'Document' },
                            { value: 'archive', label: 'Archive' },
                          ]}
                        />
                      </div>

                      {/* Connected Account */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Connected Account
                        </label>
                        <Combobox
                          className="mt-1"
                          value={filterAccountId}
                          onValueChange={(id) => setFilterAccountId(id)}
                          options={[
                            { value: '', label: 'All Accounts' },
                            ...accounts.map((acc) => ({
                              value: acc.id,
                              label: `${acc.email} (${acc.provider})`,
                            })),
                          ]}
                        />
                      </div>

                      {/* Date range */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Date Range
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="block w-full rounded-sm border border-border bg-muted px-3 py-2 text-sm focus:border-ring focus:bg-card focus:outline-none"
                          />
                          <span className="text-muted-foreground text-xs font-semibold">to</span>
                          <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="block w-full rounded-sm border border-border bg-muted px-3 py-2 text-sm focus:border-ring focus:bg-card focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setFiltersOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button variant="default" size="sm" type="button" onClick={applyFilters}>
                        Apply Filters
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {/* Header actions injected by child pages */}
              {headerActions ? (
                <div className="hidden lg:flex items-center gap-2 shrink-0">{headerActions}</div>
              ) : null}
              <div className="relative hidden flex-wrap gap-2 lg:flex shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Toggle theme"
                  onClick={toggleTheme}
                >
                  {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="relative"
                  aria-label="System info"
                  aria-expanded={infoOpen}
                  onClick={() => setInfoOpen(!infoOpen)}
                >
                  <Bell className="h-5 w-5" />
                  {!infoOpen ? (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                  ) : null}
                </Button>
                {infoOpen ? <SystemInfoDropdown storage={storage} /> : null}
              </div>
            </header>
            <Outlet context={{ setHeaderActions } satisfies DriveLayoutContext} />
          </section>
        </div>

        {uploadProgress.open ? (
          <div className="fixed inset-x-3 bottom-3 z-30 max-h-[70dvh] overflow-hidden rounded-sm border border-border bg-card shadow-2xl shadow-slate-900/20 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(420px,calc(100vw-2.5rem))]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 font-extrabold text-sm text-foreground">
                {uploadProgress.status === 'done' ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                ) : uploadProgress.status === 'partial' || uploadProgress.status === 'error' ? (
                  <X className="h-5 w-5 text-red-500" />
                ) : (
                  <Upload className="h-5 w-5 text-primary" />
                )}
                {uploadProgress.status === 'done'
                  ? 'Upload complete'
                  : uploadProgress.status === 'partial'
                    ? 'Upload completed with errors'
                    : uploadProgress.status === 'error'
                      ? 'Upload failed'
                      : uploadProgress.percent >= 99
                        ? 'Processing on server'
                        : 'Uploading files'}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setUploadProgressCollapsed(!uploadProgressCollapsed)}
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      uploadProgressCollapsed && 'rotate-180',
                    )}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setUploadProgress((current) => ({ ...current, open: false }))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {!uploadProgressCollapsed && (
              <div className="p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="truncate font-semibold">{uploadProgress.fileName}</p>
                  <span className="text-muted-foreground">{uploadProgress.percent}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-muted">
                  <div
                    className={
                      uploadProgress.status === 'error' || uploadProgress.status === 'partial'
                        ? 'h-full rounded-full bg-red-500'
                        : uploadProgress.status === 'done'
                          ? 'h-full rounded-full bg-emerald-500'
                          : 'h-full rounded-full bg-primary'
                    }
                    style={{ width: `${uploadProgress.percent}%` }}
                  />
                </div>
                {uploadProgress.files.length > 0 ? (
                  <div className="mt-4 grid max-h-64 gap-3 overflow-y-auto pr-1 text-foreground">
                    {uploadProgress.files.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${index}`}
                        className="grid gap-1 rounded-sm bg-muted p-3"
                      >
                        <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
                          <p className="min-w-0 flex-1 truncate font-semibold" title={file.name}>
                            {file.name}
                          </p>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {file.percent}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{formatBytes(file.size)}</span>
                          <div className="flex items-center gap-2">
                            {file.status === 'error' && (
                              <Button
                                variant="default"
                                className="h-6 px-2 text-[11px] font-extrabold text-white bg-primary shadow-none border-none"
                                onClick={() => retryFailedUpload(file.name)}
                              >
                                Retry
                              </Button>
                            )}
                            <span
                              className={
                                file.status === 'error'
                                  ? 'font-semibold text-destructive'
                                  : file.status === 'done'
                                    ? 'font-semibold text-emerald-600'
                                    : 'font-semibold text-primary'
                              }
                            >
                              {file.status === 'error'
                                ? 'Failed'
                                : file.status === 'done'
                                  ? 'Done'
                                  : file.percent >= 99
                                    ? 'Processing'
                                    : 'Uploading'}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-accent">
                          <div
                            className={
                              file.status === 'error'
                                ? 'h-full rounded-full bg-red-500'
                                : file.status === 'done'
                                  ? 'h-full rounded-full bg-emerald-500'
                                  : 'h-full rounded-full bg-primary'
                            }
                            style={{ width: `${file.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </main>
    </SidebarProvider>
  );
}
