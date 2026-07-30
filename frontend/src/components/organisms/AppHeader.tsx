import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Bell, Moon, Search, SlidersHorizontal, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { BrandLogo } from '@/components/atoms/BrandLogo';
import { SearchFilterPanel, type SearchFilters } from '@/components/molecules/SearchFilterPanel';
import { SystemInfoDropdown } from '@/components/molecules/SystemInfoDropdown';
import type { StorageSummary } from '@/components/organisms/AppSidebar';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

type ConnectedAccount = { id: string; email: string; provider: string };

const emptyFilters: SearchFilters = { kind: '', accountId: '', startDate: '', endDate: '' };

/**
 * Search is the header's own concern: it owns the query/filter state and writes it to the
 * URL, which is where AllFilesPage reads it back from.
 */
export function AppHeader({
  storage,
  theme,
  onToggleTheme,
  headerActions,
}: {
  storage: StorageSummary | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  headerActions: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '');
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);

  useEffect(() => {
    apiFetch<{ accounts: ConnectedAccount[] }>('/connected-accounts')
      .then((data) => setAccounts(data.accounts))
      .catch((e) => console.error('Failed to load accounts for filter dropdown', e));
  }, []);

  // The URL is the source of truth, so a back/forward navigation rehydrates the inputs.
  useEffect(() => {
    setSearchValue(searchParams.get('q') ?? '');
    setFilters({
      kind: searchParams.get('kind') ?? '',
      accountId: searchParams.get('accountId') ?? '',
      startDate: searchParams.get('startDate')?.split('T')[0] ?? '',
      endDate: searchParams.get('endDate')?.split('T')[0] ?? '',
    });
  }, [searchParams]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setInfoOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function navigateWithFilters(next: SearchFilters) {
    const nextParams = new URLSearchParams();
    const activeFolderId = searchParams.get('folderId');
    if (activeFolderId && location.pathname === '/all-files')
      nextParams.set('folderId', activeFolderId);

    const q = searchValue.trim();
    if (q) nextParams.set('q', q);
    if (next.kind) nextParams.set('kind', next.kind);
    if (next.accountId) nextParams.set('accountId', next.accountId);
    if (next.startDate) nextParams.set('startDate', new Date(next.startDate).toISOString());
    if (next.endDate) nextParams.set('endDate', new Date(next.endDate).toISOString());

    setFiltersOpen(false);
    navigate({ pathname: '/all-files', search: nextParams.toString() });
  }

  function clearFilters() {
    setFilters(emptyFilters);
    navigateWithFilters(emptyFilters);
  }

  function searchFiles(event: FormEvent) {
    event.preventDefault();
    navigateWithFilters(filters);
  }

  const themeButton = (
    <Button variant="outline" size="icon" aria-label="Toggle theme" onClick={onToggleTheme}>
      {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </Button>
  );

  const infoButton = (
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
  );

  return (
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
          {themeButton}
          <div className="relative shrink-0">
            {infoButton}
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
          <SearchFilterPanel
            filters={filters}
            accounts={accounts}
            onChange={setFilters}
            onApply={() => navigateWithFilters(filters)}
            onClear={clearFilters}
            onCancel={() => setFiltersOpen(false)}
          />
        )}
      </div>
      {/* Header actions injected by child pages */}
      {headerActions ? (
        <div className="hidden lg:flex items-center gap-2 shrink-0">{headerActions}</div>
      ) : null}
      <div className="relative hidden flex-wrap gap-2 lg:flex shrink-0">
        {themeButton}
        {infoButton}
        {infoOpen ? <SystemInfoDropdown storage={storage} /> : null}
      </div>
    </header>
  );
}
