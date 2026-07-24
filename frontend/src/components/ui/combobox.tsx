'use client';

import * as React from 'react';
import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';

import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { UnfoldMoreIcon, Tick02Icon, Search01Icon } from '@hugeicons/core-free-icons';

export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type ComboboxProps = {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  contentClassName?: string;
  /** Set false for static option lists (no search box needed). @default true */
  searchable?: boolean;
};

function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results.',
  disabled,
  id,
  name,
  className,
  contentClassName,
  searchable = true,
}: ComboboxProps) {
  const selected = React.useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  return (
    <ComboboxPrimitive.Root
      items={options}
      value={selected}
      disabled={disabled}
      name={name}
      isItemEqualToValue={(a: ComboboxOption, b: ComboboxOption) => a?.value === b?.value}
      onValueChange={(next: ComboboxOption | null) => onValueChange(next?.value ?? '')}
    >
      <ComboboxPrimitive.Trigger
        id={id}
        data-slot="combobox-trigger"
        className={cn(
          "flex h-9 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-input/20 px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[popup-open]:border-ring dark:bg-input/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
          className,
        )}
      >
        <span className="line-clamp-1 flex-1 text-left">
          <ComboboxPrimitive.Value>
            {(item: ComboboxOption | null) =>
              item?.label ?? <span className="text-muted-foreground">{placeholder}</span>
            }
          </ComboboxPrimitive.Value>
        </span>
        <ComboboxPrimitive.Icon
          render={
            <HugeiconsIcon
              icon={UnfoldMoreIcon}
              strokeWidth={2}
              className="pointer-events-none size-3.5 text-muted-foreground"
            />
          }
        />
      </ComboboxPrimitive.Trigger>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={4} className="isolate z-50" align="start">
          <ComboboxPrimitive.Popup
            data-slot="combobox-content"
            className={cn(
              'relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-40 origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
              contentClassName,
            )}
          >
            {searchable ? (
              <div className="flex items-center gap-2 border-b border-border px-3">
                <HugeiconsIcon
                  icon={Search01Icon}
                  strokeWidth={2}
                  className="pointer-events-none size-3.5 shrink-0 text-muted-foreground"
                />
                <ComboboxPrimitive.Input
                  placeholder={searchPlaceholder}
                  className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            ) : null}
            <ComboboxPrimitive.Empty className="px-3 py-4 text-center text-xs text-muted-foreground empty:hidden empty:p-0">
              {emptyText}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="max-h-64 scroll-py-1 overflow-y-auto overscroll-contain p-1">
              {(option: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={option.value}
                  value={option}
                  disabled={option.disabled}
                  data-slot="combobox-item"
                  className="relative flex min-h-8 w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex items-center justify-center">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      strokeWidth={2}
                      className="pointer-events-none size-3.5"
                    />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}

export { Combobox };
