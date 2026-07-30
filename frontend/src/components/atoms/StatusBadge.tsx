import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'primary' | 'success';

const tones: Record<Tone, string> = {
  neutral: 'bg-accent text-accent-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-100 text-emerald-600',
};

export function StatusBadge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', tones[tone], className)}>
      {children}
    </span>
  );
}
