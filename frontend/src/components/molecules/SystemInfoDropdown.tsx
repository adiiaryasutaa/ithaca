import { HardDrive, Info, ShieldCheck } from 'lucide-react';
import type { StorageSummary } from '@/components/organisms/AppSidebar';

export function SystemInfoDropdown({ storage }: { storage: StorageSummary | null }) {
  const activeGoogle =
    storage?.accounts?.filter(
      (account) => account.provider === 'google_drive' && account.status === 'connected',
    ) ?? [];

  return (
    <div className="absolute right-0 top-12 z-50 w-[min(calc(100vw-2rem),22rem)] overflow-hidden rounded-sm border border-border bg-card shadow-2xl shadow-slate-950/15">
      <div className="border-b border-border px-4 py-3 bg-muted">
        <p className="text-sm font-extrabold text-foreground">Workspace Status & Info</p>
        <p className="text-xs text-muted-foreground">Overview of your connections & guidelines</p>
      </div>
      <div className="max-h-96 overflow-y-auto p-4 space-y-4">
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
            {activeGoogle.map((account) => (
              <p key={account.id} className="text-[11px] text-muted-foreground truncate px-2.5">
                — {account.email}
              </p>
            ))}
          </div>
        </div>

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
