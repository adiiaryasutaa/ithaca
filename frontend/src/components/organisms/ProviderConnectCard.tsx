import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function ProviderConnectCard({
  icon: Icon,
  title,
  description,
  actionIcon: ActionIcon,
  actionLabel,
  actionVariant = 'default',
  disabled,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionIcon: LucideIcon;
  actionLabel: string;
  actionVariant?: 'default' | 'outline';
  disabled?: boolean;
  onAction: () => void;
}) {
  return (
    <Card className="overflow-hidden p-3.5">
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="text-[16px] font-bold">{title}</h2>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        </div>
        <Button
          className="w-full sm:w-32"
          size="sm"
          variant={actionVariant}
          onClick={onAction}
          disabled={disabled}
        >
          <ActionIcon className="h-4 w-4" />
          {actionLabel}
        </Button>
      </div>
    </Card>
  );
}
