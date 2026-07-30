import { useState, type ChangeEvent } from 'react';
import { Database, HardDrive, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { API_URL } from '@/lib/api';
import { clearAuthSession, getAccessToken } from '@/lib/auth';
import { confirmToast } from '@/lib/confirm-toast';
import { saveBlob } from '@/lib/download';

/**
 * Admin-only, and only meaningful on SQLite deployments — the backend returns 501 for
 * Postgres/Neon, where there is no local database file to copy.
 */
export function BackupRestoreCard() {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  async function downloadBackup() {
    setDownloading(true);
    try {
      const response = await fetch(`${API_URL}/system/backup`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (!response.ok) throw new Error('Failed to retrieve database backup.');
      saveBlob(await response.blob(), 'ithaca-backup.db');
    } catch (err: any) {
      toast.error('Failed to download backup: ' + err.message);
    } finally {
      setDownloading(false);
    }
  }

  function handleRestoreFileChange(e: ChangeEvent<HTMLInputElement>) {
    setRestoreFile(e.target.files?.[0] ?? null);
  }

  async function performRestore(file: File) {
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/system/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to restore database.');

      toast.success(
        data.message || 'Database restored successfully! Logging you out and reloading...',
      );

      // The restored database has different session rows, so the current token is dead.
      setTimeout(() => {
        clearAuthSession();
        window.location.href = '/login';
      }, 4000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore database.');
    } finally {
      setRestoring(false);
    }
  }

  function restoreBackup() {
    if (!restoreFile) return;
    const file = restoreFile;
    confirmToast(
      'WARNING: Restoring database will overwrite all your current configurations, connected accounts, virtual folders, and user accounts. The server will restart. Are you sure you want to proceed?',
      () => performRestore(file),
      'Restore',
    );
  }

  return (
    <Card className="overflow-hidden p-3.5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="text-[16px] font-bold">Backup &amp; Restore Database</h2>
          </div>
          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
            SQLite Local Database
          </span>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-sm bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/30 hover:border-emerald-500/40 transition-all duration-300 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 shrink-0 rounded-sm bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <HardDrive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground dark:text-slate-100">
                  Download Database Backup
                </h3>
                <p className="mt-1 text-[12px] text-muted-foreground dark:text-muted-foreground leading-normal">
                  Save a copy of your active database containing accounts, virtual folders, file
                  metadata, and configurations.
                </p>
              </div>
            </div>
            <Button className="mt-5 w-full" onClick={downloadBackup} disabled={downloading}>
              <HardDrive className="h-4 w-4" />
              {downloading ? 'Downloading...' : 'Download Backup'}
            </Button>
          </div>

          <div className="rounded-sm bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 dark:border-amber-500/30 hover:border-amber-500/40 transition-all duration-300 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 shrink-0 rounded-sm bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground dark:text-slate-100">
                  Restore Database Backup
                </h3>
                <p className="mt-1 text-[12px] text-muted-foreground dark:text-muted-foreground leading-normal">
                  Upload a previously downloaded Ithaca backup file to replace the active database.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <Input type="file" accept=".db" onChange={handleRestoreFileChange} />
              <Button
                variant="destructive"
                className="w-full"
                onClick={restoreBackup}
                disabled={!restoreFile || restoring}
              >
                <RefreshCw className={restoring ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                {restoring ? 'Restoring & Restarting...' : 'Restore Backup'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
