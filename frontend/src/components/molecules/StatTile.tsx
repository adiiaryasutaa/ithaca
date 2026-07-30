import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Icon above a big number. Distinct from MetricCard, which puts the icon beside the value. */
export function StatTile({
  icon: Icon,
  value,
  label,
  iconClassName,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  iconClassName?: string;
}) {
  return (
    <Card className="p-4">
      <Icon className={cn('h-5 w-5 text-primary', iconClassName)} />
      <p className="mt-3 text-2xl font-extrabold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Card>
  );
}
