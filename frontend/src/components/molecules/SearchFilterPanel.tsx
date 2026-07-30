import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';

export type SearchFilters = {
  kind: string;
  accountId: string;
  startDate: string;
  endDate: string;
};

export function SearchFilterPanel({
  filters,
  accounts,
  onChange,
  onApply,
  onClear,
  onCancel,
}: {
  filters: SearchFilters;
  accounts: { id: string; email: string; provider: string }[];
  onChange: (filters: SearchFilters) => void;
  onApply: () => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const set = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="absolute left-0 right-0 top-12 z-50 rounded-sm border border-border bg-card p-5 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <span className="text-sm font-extrabold text-foreground">Advanced Search Filters</span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-bold text-primary hover:text-primary"
        >
          Clear All
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            File Type
          </label>
          <Combobox
            className="mt-1"
            searchable={false}
            value={filters.kind}
            onValueChange={(kind) => set('kind', kind)}
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

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Connected Account
          </label>
          <Combobox
            className="mt-1"
            value={filters.accountId}
            onValueChange={(id) => set('accountId', id)}
            options={[
              { value: '', label: 'All Accounts' },
              ...accounts.map((account) => ({
                value: account.id,
                label: `${account.email} (${account.provider})`,
              })),
            ]}
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Date Range
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              className="block w-full rounded-sm border border-border bg-muted px-3 py-2 text-sm focus:border-ring focus:bg-card focus:outline-none"
            />
            <span className="text-muted-foreground text-xs font-semibold">to</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => set('endDate', e.target.value)}
              className="block w-full rounded-sm border border-border bg-muted px-3 py-2 text-sm focus:border-ring focus:bg-card focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" size="sm" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="default" size="sm" type="button" onClick={onApply}>
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
