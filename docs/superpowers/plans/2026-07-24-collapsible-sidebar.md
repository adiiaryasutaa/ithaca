# Collapsible Desktop Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shadcn-style collapsible sidebar to Ithaca's `DriveLayout` — on `lg`+ screens the sidebar can collapse to an icon-only rail and expand back, with state persisted across reloads. Mobile's existing slide-in drawer is untouched.

**Architecture:** A new `SidebarProvider` React context (persisted to `localStorage`) tracks `collapsed`/`toggleCollapsed`. The existing inline `Sidebar` function in `DriveLayout.tsx` is extracted into its own `AppSidebar.tsx` component that renders two ways (expanded/icon-rail) based on that context, with a `forceExpanded` escape hatch for the mobile overlay instance.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, `@base-ui/react` (existing `Card`/`Button` primitives), `lucide-react`, `react-router-dom` `NavLink`, Vitest (for the one pure-logic unit).

## Global Constraints

- No new npm dependencies — specifically no `radix-ui`. The project's `components/ui/*` are built on `@base-ui/react`; this feature must not introduce a second primitive library.
- Persist collapsed state as a boolean in `localStorage` under the key `ithaca:sidebar-collapsed` (mirrors the existing `ithaca:theme` key pattern in `frontend/src/layouts/DriveLayout.tsx`).
- Desktop icon-rail width is `w-16` (4rem); expanded width stays `w-64` (16rem), transitioning via `transition-[width] duration-200`.
- Collapsed-state hover labels use the native HTML `title` attribute, not the `components/ui/tooltip.tsx` Base UI component. Base UI's `TooltipTrigger` composes via a `render` prop that clones the target element (see `dialog.tsx`/`select.tsx` for the pattern); composing it with `react-router-dom`'s `NavLink` — which itself takes a function-valued `className` prop resolved internally by `NavLink` — has undocumented, unverified merge behavior for that prop shape. A native `title` attribute gives the exact same user-facing result (hover shows the label) with zero composition risk and no new import. This is a deliberate simplification from the design doc's wording, not a scope change.
- Follow existing code style: Tailwind utility classes via `cn()` from `@/lib/utils`, no comments unless documenting a non-obvious constraint, no raw color classes (semantic tokens only).
- No test suite exists for React components/hooks in this project (only pure `lib/*.ts` helpers have Vitest unit tests, e.g. `frontend/src/lib/auth.test.ts`). Follow that exact pattern for the one pure unit here (the storage helper); everything else is verified by `tsc`/`vite build` plus manual browser verification, matching `CLAUDE.md`'s stated verification approach for this project.

---

### Task 1: Sidebar-collapsed storage helper (TDD)

**Files:**
- Create: `frontend/src/lib/sidebar-storage.ts`
- Create: `frontend/src/lib/sidebar-storage.test.ts`

**Interfaces:**
- Produces: `getStoredSidebarCollapsed(): boolean`, `setStoredSidebarCollapsed(collapsed: boolean): void` — consumed by Task 2's `SidebarProvider`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/sidebar-storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredSidebarCollapsed, setStoredSidebarCollapsed } from './sidebar-storage';

beforeEach(() => {
  localStorage.clear();
});

describe('sidebar collapsed storage', () => {
  it('defaults to expanded (false) when nothing is stored', () => {
    expect(getStoredSidebarCollapsed()).toBe(false);
  });

  it('roundtrips true', () => {
    setStoredSidebarCollapsed(true);
    expect(getStoredSidebarCollapsed()).toBe(true);
  });

  it('roundtrips false after being true', () => {
    setStoredSidebarCollapsed(true);
    setStoredSidebarCollapsed(false);
    expect(getStoredSidebarCollapsed()).toBe(false);
  });

  it('treats an unrecognized stored value as expanded', () => {
    localStorage.setItem('ithaca:sidebar-collapsed', 'yes');
    expect(getStoredSidebarCollapsed()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `frontend/`): `npx vitest run src/lib/sidebar-storage.test.ts`
Expected: FAIL — `Failed to resolve import "./sidebar-storage"` (the module doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `frontend/src/lib/sidebar-storage.ts`:

```ts
const SIDEBAR_COLLAPSED_KEY = 'ithaca:sidebar-collapsed';

export function getStoredSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
}

export function setStoredSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? 'true' : 'false');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `frontend/`): `npx vitest run src/lib/sidebar-storage.test.ts`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/sidebar-storage.ts frontend/src/lib/sidebar-storage.test.ts
git commit -m "feat(sidebar): add localStorage helper for collapsed state"
```

---

### Task 2: SidebarProvider context + keyboard shortcut

**Files:**
- Create: `frontend/src/components/drive/sidebar-context.tsx`

**Interfaces:**
- Consumes: `getStoredSidebarCollapsed`, `setStoredSidebarCollapsed` from `frontend/src/lib/sidebar-storage.ts` (Task 1).
- Produces: `SidebarProvider({ children }: { children: ReactNode })` component and `useSidebar(): { collapsed: boolean; toggleCollapsed: () => void }` hook — consumed by Task 3 (`AppSidebar`) and Task 4 (`DriveLayout`).

- [ ] **Step 1: Write the file**

Create `frontend/src/components/drive/sidebar-context.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getStoredSidebarCollapsed, setStoredSidebarCollapsed } from '@/lib/sidebar-storage';

type SidebarContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(getStoredSidebarCollapsed);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      setStoredSidebarCollapsed(next);
      return next;
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'b') return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      toggleCollapsed();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors mentioning `sidebar-context.tsx` (the file isn't imported anywhere yet, so it just needs to compile standalone).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/drive/sidebar-context.tsx
git commit -m "feat(sidebar): add SidebarProvider context with Ctrl/Cmd+B toggle"
```

---

### Task 3: Extract AppSidebar with collapsed/expanded rendering

**Files:**
- Create: `frontend/src/components/drive/AppSidebar.tsx`

**Interfaces:**
- Consumes: `useSidebar()` from `frontend/src/components/drive/sidebar-context.tsx` (Task 2); `BrandLogo` from `frontend/src/components/drive/BrandLogo.tsx`; `Card` from `@/components/ui/card`; `cn` from `@/lib/utils`; `formatBytes` from `@/lib/api`; `getGravatarUrl` from `@/lib/gravatar`; `type AuthUser` from `@/lib/auth`.
- Produces: `export type StorageSummary`, `export type StorageBreakdown`, `export function AppSidebar(props)` where:
  ```ts
  {
    onNavigate?: () => void;
    user: AuthUser | null;
    storage: StorageSummary | null;
    breakdown: StorageBreakdown;
    onLogout: () => void;
    forceExpanded?: boolean; // default false
  }
  ```
  — consumed by Task 4 (`DriveLayout.tsx`, both the desktop static instance and the mobile overlay instance with `forceExpanded`).

- [ ] **Step 1: Write the file**

Create `frontend/src/components/drive/AppSidebar.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Braces,
  FileArchive,
  Gauge,
  History,
  LogOut,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Share2,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { BrandLogo } from '@/components/drive/BrandLogo';
import { useSidebar } from '@/components/drive/sidebar-context';
import { Card } from '@/components/ui/card';
import { formatBytes } from '@/lib/api';
import type { AuthUser } from '@/lib/auth';
import { getGravatarUrl } from '@/lib/gravatar';
import { cn } from '@/lib/utils';

const menu = [
  { label: 'All Files', icon: FileArchive, href: '/all-files' },
  { label: 'Quota Tracker', icon: Gauge, href: '/quota' },
  { label: 'Shared With Me', icon: Share2, href: '/shared' },
  { label: 'Starred', icon: Star, href: '/starred', disabled: true },
  { label: 'Recycle Bin', icon: Trash2, href: '/trash' },
  { label: 'Activity Log', icon: History, href: '/activity' },
  { label: 'Setting', icon: Settings, href: '/settings' },
  { label: 'API Keys', icon: Braces, href: '/api' },
];

export type StorageSummary = {
  totalBytes: string;
  usedBytes: string;
  availableBytes: string;
};

export type StorageBreakdown = {
  photo: string;
  video: string;
  document: string;
};

const navItemBaseClass =
  'inline-flex h-10 items-center gap-2.5 rounded-sm text-[13px] font-bold transition-all border border-transparent';

function navItemClass(collapsed: boolean, isActive: boolean) {
  return cn(
    navItemBaseClass,
    collapsed ? 'w-10 justify-center' : 'px-3.5',
    isActive
      ? 'bg-primary/10 text-primary border-ring/10'
      : 'text-muted-foreground hover:text-foreground',
  );
}

export function AppSidebar({
  onNavigate,
  user,
  storage,
  breakdown,
  onLogout,
  forceExpanded = false,
}: {
  onNavigate?: () => void;
  user: AuthUser | null;
  storage: StorageSummary | null;
  breakdown: StorageBreakdown;
  onLogout: () => void;
  forceExpanded?: boolean;
}) {
  const { collapsed: contextCollapsed, toggleCollapsed } = useSidebar();
  const collapsed = forceExpanded ? false : contextCollapsed;
  const used = Number(storage?.usedBytes ?? 0);
  const total = Number(storage?.totalBytes ?? 0);
  const progress = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [avatarError, setAvatarError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const items: [string, string, string][] = [
    ['Photo', formatBytes(breakdown.photo), 'bg-lime-500'],
    ['Video', formatBytes(breakdown.video), 'bg-yellow-400'],
    ['Document', formatBytes(breakdown.document), 'bg-cyan-400'],
    ['Free Storage', formatBytes(storage?.availableBytes), 'bg-orange-500'],
  ];

  useEffect(() => {
    setAvatarError(false);
    getGravatarUrl(user?.email, 64)
      .then(setProfileImageUrl)
      .catch(() => setProfileImageUrl(''));
  }, [user?.email]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-sidebar-border bg-sidebar text-sidebar-foreground p-4 transition-[width] duration-200 lg:border-r',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex items-center pb-3 pt-1',
          collapsed ? 'flex-col gap-2' : 'justify-between gap-2.5',
        )}
      >
        <BrandLogo className="h-8 w-8 shrink-0" />
        {!collapsed ? (
          <span className="flex-1 text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Ithaca
          </span>
        ) : null}
        {!forceExpanded ? (
          <button
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={toggleCollapsed}
            className="shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>

      <nav className={cn('mt-3 grid gap-1', collapsed && 'justify-items-center')}>
        {menu.map((item) =>
          item.disabled ? (
            <button
              key={item.label}
              type="button"
              disabled
              title={collapsed ? item.label : undefined}
              className={cn(
                'inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-sm text-[13px] font-bold text-muted-foreground opacity-60',
                collapsed ? 'w-10 justify-center' : 'px-3.5',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </button>
          ) : (
            <NavLink
              key={item.label}
              to={item.href}
              title={collapsed ? item.label : undefined}
              onClick={onNavigate}
              className={({ isActive }) => navItemClass(collapsed, isActive)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          ),
        )}
        {user?.role === 'admin' ? (
          <NavLink
            to="/users"
            title={collapsed ? 'Users' : undefined}
            onClick={onNavigate}
            className={({ isActive }) => navItemClass(collapsed, isActive)}
          >
            <Users className="h-4 w-4 shrink-0" />
            {!collapsed && 'Users'}
          </NavLink>
        ) : null}
      </nav>

      <Card
        size="sm"
        className={cn('mt-auto text-[13px] !overflow-visible', collapsed && 'px-2 py-3')}
      >
        <div
          ref={menuRef}
          className={cn(
            'relative flex items-center gap-2.5',
            collapsed ? 'flex-col' : 'px-(--card-spacing)',
          )}
        >
          {!profileImageUrl || avatarError ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white shadow-sm border border-blue-400/20">
              {(user?.name ?? user?.email ?? 'U').trim().charAt(0).toUpperCase()}
            </div>
          ) : (
            <img
              src={profileImageUrl}
              alt="User avatar"
              className="h-8 w-8 rounded-full border border-border object-cover"
              onError={() => setAvatarError(true)}
            />
          )}
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-foreground leading-none">
                {user?.name ?? 'User'}
              </p>
              <p className="truncate text-xs text-muted-foreground mt-1">
                {user?.email ?? 'Loading...'}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            aria-label="Profile menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div
              className={cn(
                'absolute z-50 w-44 overflow-hidden rounded-sm border border-border bg-card shadow-xl shadow-slate-950/10',
                collapsed ? 'left-full bottom-0 ml-2' : 'right-0 bottom-full mb-1',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] font-bold text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Log Out
              </button>
            </div>
          ) : null}
        </div>

        {!collapsed ? (
          <>
            <div className="border-t border-border" />
            <div className="px-(--card-spacing)">
              <div className="mb-3 space-y-1.5">
                {items.map(([label, value, color]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between text-muted-foreground font-medium"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={cn('h-1.5 w-1.5 rounded-full', color)} />
                      {label}
                    </span>
                    <span className="font-semibold text-foreground">{value}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm font-bold text-foreground">
                <span>{formatBytes(storage?.usedBytes)} used</span>
                <span className="text-muted-foreground">{formatBytes(storage?.totalBytes)}</span>
              </div>
              <div className="my-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </>
        ) : null}
      </Card>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors mentioning `AppSidebar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/drive/AppSidebar.tsx
git commit -m "feat(sidebar): add AppSidebar with icon-rail collapsed mode"
```

---

### Task 4: Wire AppSidebar + SidebarProvider into DriveLayout

**Files:**
- Modify: `frontend/src/layouts/DriveLayout.tsx`

**Interfaces:**
- Consumes: `SidebarProvider` from `frontend/src/components/drive/sidebar-context.tsx` (Task 2); `AppSidebar`, `type StorageSummary`, `type StorageBreakdown` from `frontend/src/components/drive/AppSidebar.tsx` (Task 3).

- [ ] **Step 1: Remove the now-unused `menu` array**

In `frontend/src/layouts/DriveLayout.tsx` (currently lines 47-56), delete this block (it now lives in `AppSidebar.tsx`):

```ts
const menu = [
  { label: 'All Files', icon: FileArchive, href: '/all-files' },
  { label: 'Quota Tracker', icon: Gauge, href: '/quota' },
  { label: 'Shared With Me', icon: Share2, href: '/shared' },
  { label: 'Starred', icon: Star, href: '/starred', disabled: true },
  { label: 'Recycle Bin', icon: Trash2, href: '/trash' },
  { label: 'Activity Log', icon: History, href: '/activity' },
  { label: 'Setting', icon: Settings, href: '/settings' },
  { label: 'API Keys', icon: Braces, href: '/api' },
];
```

- [ ] **Step 2: Remove the now-unused `StorageSummary`/`StorageBreakdown` type definitions**

Delete this block (currently lines 58-68, now exported from `AppSidebar.tsx` instead):

```ts
type StorageSummary = {
  totalBytes: string;
  usedBytes: string;
  availableBytes: string;
};

type StorageBreakdown = {
  photo: string;
  video: string;
  document: string;
};
```

- [ ] **Step 3: Remove the entire inline `Sidebar` function**

Delete the whole `function Sidebar({ ... }) { ... }` block (currently lines 143-331) — everything from `function Sidebar({` through its closing `}` right before `type ConnectedAccount = {`. This is the function that started with:

```tsx
function Sidebar({
  onNavigate,
  user,
  storage,
  breakdown,
  onLogout,
}: {
```

and ended with the closing `</aside>);\n}` of that function. It's fully superseded by `AppSidebar.tsx`.

- [ ] **Step 4: Update the icon/type imports**

Replace the `lucide-react` import block:

```ts
import {
  Bell,
  Braces,
  FileArchive,
  Gauge,
  History,
  LogOut,
  Menu,
  Moon,
  MoreVertical,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Star,
  Sun,
  Trash2,
  X,
  ShieldCheck,
  HardDrive,
  Info,
  CheckCircle,
  ChevronDown,
  Upload,
  Users,
} from 'lucide-react';
```

with:

```ts
import {
  Bell,
  Menu,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  X,
  ShieldCheck,
  HardDrive,
  Info,
  CheckCircle,
  ChevronDown,
  Upload,
} from 'lucide-react';
```

- [ ] **Step 5: Update the component imports**

Replace:

```ts
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { BrandLogo } from '@/components/drive/BrandLogo';
import { Input } from '@/components/ui/input';
import { apiFetch, formatBytes } from '@/lib/api';
import { useUpload } from '@/context/UploadContext';
import { clearAuthSession, getStoredUser, updateStoredUser, type AuthUser } from '@/lib/auth';
import { getGravatarUrl } from '@/lib/gravatar';
import { cn } from '@/lib/utils';
```

with:

```ts
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { AppSidebar, type StorageBreakdown, type StorageSummary } from '@/components/drive/AppSidebar';
import { BrandLogo } from '@/components/drive/BrandLogo';
import { SidebarProvider } from '@/components/drive/sidebar-context';
import { Input } from '@/components/ui/input';
import { apiFetch, formatBytes } from '@/lib/api';
import { useUpload } from '@/context/UploadContext';
import { clearAuthSession, getStoredUser, updateStoredUser, type AuthUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
```

(`Card` moves out because it was only used inside the removed `Sidebar` function — verify with the grep in Step 8 below. `getGravatarUrl` moves out for the same reason.)

- [ ] **Step 6: Remove the now-unused `useRef` import**

Replace:

```ts
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
```

with:

```ts
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
```

- [ ] **Step 7: Wrap the layout in `SidebarProvider` and swap in `AppSidebar`**

Replace:

```tsx
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-background">
      <div className="flex min-h-screen w-full flex-col bg-background lg:h-screen lg:overflow-hidden lg:flex-row">
        <div className="hidden lg:block lg:h-screen lg:shrink-0">
          <Sidebar user={user} storage={storage} breakdown={breakdown} onLogout={logout} />
        </div>
        <div
          className={cn(
            'fixed inset-0 z-40 bg-slate-950/40 transition-opacity lg:hidden',
            sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          onClick={() => setSidebarOpen(false)}
        />
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 transform bg-card shadow-2xl transition-transform duration-300 ease-out lg:hidden',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="absolute right-4 top-4 z-10">
            <Button
              variant="outline"
              size="icon"
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <Sidebar
            user={user}
            storage={storage}
            breakdown={breakdown}
            onLogout={logout}
            onNavigate={() => setSidebarOpen(false)}
          />
        </div>
```

with:

```tsx
  return (
    <SidebarProvider>
      <main className="min-h-screen w-full overflow-x-hidden bg-background">
        <div className="flex min-h-screen w-full flex-col bg-background lg:h-screen lg:overflow-hidden lg:flex-row">
          <div className="hidden lg:block lg:h-screen lg:shrink-0">
            <AppSidebar user={user} storage={storage} breakdown={breakdown} onLogout={logout} />
          </div>
          <div
            className={cn(
              'fixed inset-0 z-40 bg-slate-950/40 transition-opacity lg:hidden',
              sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className={cn(
              'fixed inset-y-0 left-0 z-50 transform bg-card shadow-2xl transition-transform duration-300 ease-out lg:hidden',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <div className="absolute right-4 top-4 z-10">
              <Button
                variant="outline"
                size="icon"
                aria-label="Close sidebar"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <AppSidebar
              forceExpanded
              user={user}
              storage={storage}
              breakdown={breakdown}
              onLogout={logout}
              onNavigate={() => setSidebarOpen(false)}
            />
          </div>
```

Note the added indentation level (everything inside is now nested one level deeper under `<SidebarProvider>`) — apply it through to the end of the returned JSX, and close the new tag: find the end of the current return statement —

```tsx
      )}
    </main>
  );
}
```

— and replace with:

```tsx
        )}
      </main>
    </SidebarProvider>
  );
}
```

(i.e., add one level of indentation to the whole render tree and close `</main>` then `</SidebarProvider>`.)

- [ ] **Step 8: Verify no other reference to the removed `Sidebar` function or unused imports remains**

Run (from `frontend/`):

```bash
grep -n "<Sidebar\b\|function Sidebar(" src/layouts/DriveLayout.tsx
```

Expected: no output (empty).

- [ ] **Step 9: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors. If `noUnusedLocals`/`noUnusedParameters` flags anything (e.g. a leftover import), remove it.

- [ ] **Step 10: Run the full test suite**

Run (from `frontend/`): `npm run test`
Expected: all existing tests plus the 4 new ones from Task 1 pass.

- [ ] **Step 11: Manual browser verification**

Using the project's dev server (already running per this session at `http://localhost:5174`) at a desktop (`lg`+) viewport:

1. Load `/all-files`. Sidebar renders exactly as before (expanded, `w-64`).
2. Click the new collapse toggle button next to the logo. Sidebar animates to the icon rail (`w-16`); nav labels disappear, icons remain centered; footer shows only the avatar.
3. Hover a collapsed nav icon — the native browser tooltip shows its label after the OS's default hover delay.
4. Click a nav icon while collapsed — navigation still works, active-route highlighting (`bg-primary/10 text-primary`) still applies to the correct icon.
5. Click the avatar while collapsed — the logout dropdown opens to the right of the rail (not clipped/off-screen).
6. Click the toggle again — sidebar expands back, full content returns.
7. Reload the page — the collapsed/expanded state persists (whichever it was last set to).
8. Press `Ctrl+B` (or `Cmd+B` on Mac) — sidebar toggles. Focus the search input and press `Ctrl+B`/`Cmd+B` again — it should type/do nothing to the sidebar (guarded against typing targets) — verify the sidebar state does NOT change while the search box has focus.
9. Resize below `lg` (or use the browser pane's mobile preset) — hamburger button still opens the mobile drawer as an overlay, showing the sidebar fully expanded regardless of the desktop collapsed flag; the `X` button still closes it.

Fix any issues found, re-run Steps 9-10, then proceed.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/layouts/DriveLayout.tsx
git commit -m "feat(sidebar): wire collapsible AppSidebar into DriveLayout"
```
