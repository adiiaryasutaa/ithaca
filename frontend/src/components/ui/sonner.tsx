'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Alert02Icon,
  MultiplicationSignCircleIcon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      richColors
      icons={{
        success: <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />,
        info: <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-4" />,
        warning: <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4" />,
        error: (
          <HugeiconsIcon icon={MultiplicationSignCircleIcon} strokeWidth={2} className="size-4" />
        ),
        loading: (
          <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
          '--success-bg': 'color-mix(in oklch, var(--success) 12%, var(--popover))',
          '--success-border': 'color-mix(in oklch, var(--success) 40%, var(--popover))',
          '--success-text': 'var(--success)',
          '--warning-bg': 'color-mix(in oklch, var(--warning) 12%, var(--popover))',
          '--warning-border': 'color-mix(in oklch, var(--warning) 40%, var(--popover))',
          '--warning-text': 'var(--warning)',
          '--error-bg': 'color-mix(in oklch, var(--destructive) 12%, var(--popover))',
          '--error-border': 'color-mix(in oklch, var(--destructive) 40%, var(--popover))',
          '--error-text': 'var(--destructive)',
          '--info-bg': 'color-mix(in oklch, var(--accent) 12%, var(--popover))',
          '--info-border': 'color-mix(in oklch, var(--accent) 40%, var(--popover))',
          '--info-text': 'var(--accent)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
