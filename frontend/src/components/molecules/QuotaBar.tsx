import { cn } from '@/lib/utils';

/** Green under 50% used, amber to 80%, red above — the same thresholds the sidebar uses. */
export function quotaColor(percent: number) {
  if (percent >= 80) return 'bg-red-500';
  if (percent >= 50) return 'bg-yellow-400';
  return 'bg-emerald-500';
}

export function QuotaBar({
  percent,
  label = 'storage',
  footerLeft,
  footerRight,
}: {
  percent: number;
  label?: string;
  footerLeft: string;
  footerRight: string;
}) {
  const color = quotaColor(percent);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <span className={cn('h-3 w-3 rounded-full', color)} />
          {label}
        </span>
        <span className="font-bold">{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>{footerLeft}</span>
        <span>{footerRight}</span>
      </div>
    </div>
  );
}
