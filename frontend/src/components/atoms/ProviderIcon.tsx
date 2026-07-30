import { Cloud, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  const Icon = provider === 's3' ? Database : Cloud;
  return <Icon className={cn('h-6 w-6', className)} />;
}
