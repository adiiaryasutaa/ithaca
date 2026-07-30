import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DummyModal } from '@/components/molecules/DummyModal';
import { apiFetch } from '@/lib/api';
import { confirmToast } from '@/lib/confirm-toast';

const COMPLETION_MARKER = '=== System Update Completed:';

/**
 * Admin-only. `/system/update` returns as soon as the update script is spawned, so progress
 * is read by polling `/system/update-log`. The poll is expected to fail while the server
 * restarts itself mid-update — those failures are counted and surfaced as "reconnecting",
 * not treated as errors.
 */
export function SystemUpdateCard() {
  const [starting, setStarting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [polling, setPolling] = useState(false);
  const [log, setLog] = useState('');
  const [finished, setFinished] = useState(false);
  const [succeeded, setSucceeded] = useState<boolean | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!polling) return;

    let active = true;

    async function fetchLog() {
      try {
        const data = await apiFetch<{ log: string }>('/system/update-log');
        if (!active) return;
        setLog(data.log);
        setReconnectCount(0);
        if (data.log.includes(COMPLETION_MARKER)) {
          setFinished(true);
          setSucceeded(true);
          setPolling(false);
          setModalTitle('System Updated');
        }
      } catch {
        if (!active) return;
        setReconnectCount((prev) => prev + 1);
      }
    }

    fetchLog();
    const intervalId = setInterval(fetchLog, 2000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [polling]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [log]);

  async function runUpdate() {
    setStarting(true);
    setLog('Initiating system update in the background...\n');
    setFinished(false);
    setSucceeded(null);
    setReconnectCount(0);
    setModalTitle('System Updating');
    setModalOpen(true);

    try {
      await apiFetch<{ message: string }>('/system/update', { method: 'POST' });
      setPolling(true);
    } catch (error) {
      setModalTitle('System Update Failed');
      const errMsg = error instanceof Error ? error.message : 'System update failed to initiate.';
      setLog((prev) => prev + `\nError: ${errMsg}`);
      setFinished(true);
      setSucceeded(false);
    } finally {
      setStarting(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setPolling(false);
    if (finished && succeeded) window.location.reload();
  }

  // Closing mid-update does not cancel it, so confirm before hiding the only progress view.
  function requestClose() {
    if (!finished) {
      confirmToast(
        'The update is still running in the background. Close log viewer?',
        closeModal,
        'Close',
      );
      return;
    }
    closeModal();
  }

  return (
    <>
      <Card className="overflow-hidden p-3.5">
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <RefreshCw className="h-5 w-5 text-primary" />
              <h2 className="text-[16px] font-bold">System Update</h2>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Pull the latest code from GitHub. Dev servers will automatically restart.
            </p>
          </div>
          <Button
            className="w-full sm:w-32"
            variant="outline"
            size="sm"
            onClick={runUpdate}
            disabled={starting}
          >
            <RefreshCw className={starting ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {starting ? 'Updating...' : 'Update Code'}
          </Button>
        </div>
      </Card>

      <DummyModal
        open={modalOpen}
        title={modalTitle}
        description={
          finished
            ? succeeded
              ? 'System updated successfully'
              : 'Update failed'
            : 'Live installation logs'
        }
        className="max-w-2xl"
        onClose={requestClose}
      >
        <div className="grid gap-4">
          <div
            ref={logContainerRef}
            className="relative rounded-sm bg-slate-950 p-4 font-mono text-xs text-muted-foreground leading-relaxed border border-slate-800 h-80 overflow-y-auto select-text"
          >
            <pre className="whitespace-pre-wrap">{log}</pre>
            {!finished && (
              <div className="mt-3 flex items-center gap-2 text-primary">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>
                  {reconnectCount > 0
                    ? `Rebooting server and reconnecting... (attempt ${reconnectCount})`
                    : 'Installing updates...'}
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={requestClose}>
              Close
            </Button>
            {finished && succeeded && (
              <Button onClick={() => window.location.reload()}>Reload Page</Button>
            )}
          </div>
        </div>
      </DummyModal>
    </>
  );
}
