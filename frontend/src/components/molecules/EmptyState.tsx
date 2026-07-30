import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  message,
  actions,
  className,
}: {
  icon?: ReactNode;
  title?: string;
  message: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        'p-5 bg-card border border-border dark:bg-transparent dark:border-0 dark:shadow-none',
        className,
      )}
    >
      {icon ? <div className="flex justify-center text-muted-foreground">{icon}</div> : null}
      {title ? <h2 className="mt-4 text-center text-xl font-extrabold">{title}</h2> : null}
      <p className={cn('text-sm text-muted-foreground', title && 'mt-2 text-center')}>{message}</p>
      {actions ? <div className="mt-4 flex justify-center gap-2">{actions}</div> : null}
    </Card>
  );
}
