import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function SettingCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-4">
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="text-[14px] font-bold">{title}</h2>
      <p className="text-[12px] text-muted-foreground">{description}</p>
    </Card>
  );
}
