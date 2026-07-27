# Sidebar shadcn Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled `AppSidebar`/`sidebar-context` implementation with shadcn's official `Sidebar` primitive family (desktop icon-collapse + mobile Sheet drawer), preserving all existing nav items, admin gating, storage breakdown, and profile/logout behavior.

**Architecture:** `frontend/src/components/ui/sidebar.tsx` (already installed via `npx shadcn@latest add sidebar`, Base UI flavor matching this project's `base-mira` style) provides `SidebarProvider`/`Sidebar`/`SidebarHeader`/`SidebarContent`/`SidebarGroup`/`SidebarMenu`/`SidebarMenuButton`/`SidebarFooter`. `AppSidebar.tsx` is rewritten to compose these instead of a raw `<aside>`. `DriveLayout.tsx` swaps its provider import, deletes its hand-rolled mobile drawer/backdrop, and renders one `<AppSidebar />` instead of two conditionally-wrapped copies.

**Tech Stack:** React 19, React Router 7, Tailwind CSS 4, `@base-ui/react` (Base UI, not Radix), shadcn `base-mira` style, `lucide-react` (existing icons kept for parity), `@hugeicons/react` (via `SidebarTrigger`'s built-in icon).

## Global Constraints

- Base UI primitives only (`@base-ui/react/*`), not Radix — this project's `components.json` style is `base-mira`. Every new/changed file already follows this (confirmed by reading the installed `sidebar.tsx`, `sheet.tsx`, and existing `dropdown-menu.tsx`, `tooltip.tsx`).
- `@/*` import aliases only, no relative `../../` paths.
- Semantic Tailwind tokens only (`bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border`, `bg-primary`, `text-muted-foreground`, etc.) — never raw `slate`/`blue` palette classes. All `--sidebar-*` tokens already exist in `frontend/src/style.css` (`:root` lines 50–57, `.dark` lines 86–93) — no CSS changes needed.
- Any `<Button>` used as a form submit button must pass `type="submit"` explicitly — not applicable to this plan (no new form buttons introduced).
- Run `npm run format` (Prettier) after edits, from `frontend/`.
- No RTL work (`components.json` has `"rtl": false`).

---

### Task 1: Migrate AppSidebar and DriveLayout to shadcn Sidebar primitives

**Files:**
- Modify: `frontend/src/hooks/use-mobile.ts` (already created by `npx shadcn@latest add sidebar`)
- Modify (full rewrite): `frontend/src/components/drive/AppSidebar.tsx`
- Modify: `frontend/src/layouts/DriveLayout.tsx`
- Delete: `frontend/src/components/drive/sidebar-context.tsx`

**Interfaces:**
- Consumes (already installed, verified by reading the generated source): `Sidebar`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupContent`, `SidebarHeader`, `SidebarMenu`, `SidebarMenuButton`, `SidebarMenuItem`, `SidebarProvider`, `SidebarRail`, `SidebarTrigger`, `useSidebar` from `@/components/ui/sidebar` (`useSidebar()` returns `{ state: 'expanded' | 'collapsed', open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }`; `SidebarMenuButton` takes `isActive?: boolean`, `tooltip?: string`, `disabled?: boolean`, and a Base UI `render?: React.ReactElement` prop — no `asChild`). `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem` (`variant?: 'default' | 'destructive'`), `DropdownMenuTrigger` from `@/components/ui/dropdown-menu`. `getStoredSidebarCollapsed(): boolean`, `setStoredSidebarCollapsed(collapsed: boolean): void` from `@/lib/sidebar-storage` (unchanged, already exists).
- Produces: `AppSidebar` component with a new, smaller prop signature — `{ user: AuthUser | null; storage: StorageSummary | null; breakdown: StorageBreakdown; onLogout: () => void }` (drops the old `onNavigate` and `forceExpanded` props — both are handled internally now via `useSidebar()`). `StorageSummary` and `StorageBreakdown` types are unchanged and still exported from this file for `DriveLayout.tsx` to import.

- [ ] **Step 1: Narrow the mobile breakpoint to match the app's existing `lg:` (1024px) split**

The shadcn CLI generated `frontend/src/hooks/use-mobile.ts` with its default 768px breakpoint. This app's desktop/mobile split is Tailwind's `lg:` (1024px) everywhere else in `DriveLayout.tsx`. Edit the constant so the sidebar's collapse-rail/Sheet-drawer switch happens at the same width the rest of the layout already switches at:

```ts
// frontend/src/hooks/use-mobile.ts
const MOBILE_BREAKPOINT = 1024
```

(This is the only change to this file — replace `768` with `1024` on line 3.)

- [ ] **Step 2: Rewrite `frontend/src/components/drive/AppSidebar.tsx`**

Replace the entire file with:

```tsx
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
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

function SidebarToggleButton() {
  const { state, isMobile, toggleSidebar } = useSidebar();
  if (isMobile) return null;
  const collapsed = state === 'collapsed';
  return (
    <button
      type="button"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      onClick={toggleSidebar}
      className="shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );
}

export function AppSidebar({
  user,
  storage,
  breakdown,
  onLogout,
}: {
  user: AuthUser | null;
  storage: StorageSummary | null;
  breakdown: StorageBreakdown;
  onLogout: () => void;
}) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = !isMobile && state === 'collapsed';
  const location = useLocation();
  const used = Number(storage?.usedBytes ?? 0);
  const total = Number(storage?.totalBytes ?? 0);
  const progress = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [avatarError, setAvatarError] = useState(false);
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

  function closeMobileOnNavigate() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
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
          <SidebarToggleButton />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menu.map((item) =>
                item.disabled ? (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton disabled tooltip={item.label}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={location.pathname === item.href}
                      tooltip={item.label}
                      render={<NavLink to={item.href} onClick={closeMobileOnNavigate} />}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
              {user?.role === 'admin' ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location.pathname === '/users'}
                    tooltip="Users"
                    render={<NavLink to="/users" onClick={closeMobileOnNavigate} />}
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    <span>Users</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!collapsed ? (
          <div className="space-y-2 px-1 pb-1 text-[13px]">
            <div className="space-y-1.5">
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
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
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
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[15px] font-bold text-foreground leading-none">
                      {user?.name ?? 'User'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground mt-1">
                      {user?.email ?? 'Loading...'}
                    </p>
                  </div>
                ) : null}
                {!collapsed ? (
                  <MoreVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : null}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={collapsed ? 'right' : 'top'}
                align="start"
                className="w-56"
              >
                <DropdownMenuItem variant="destructive" onClick={onLogout}>
                  <LogOut className="h-4 w-4" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
```

Notes for the implementer:
- `render={<NavLink to={item.href} onClick={closeMobileOnNavigate} />}` is this codebase's Base UI composition pattern (`useRender`), equivalent to Radix's `asChild` — confirmed by the identical pattern already used in the generated `sheet.tsx`'s close button (`SheetPrimitive.Close` with `render={<Button .../>}`). Do not look for or add an `asChild` prop — it doesn't exist in this style.
- `isActive` is computed manually via `location.pathname === item.href` instead of `NavLink`'s own `className={({isActive}) => ...}` render-prop, because `NavLink` here is used only as the `render` target (a plain element), not as a function-as-children component. All `menu` hrefs are distinct top-level paths with no overlapping prefixes, so exact-match is equivalent to `NavLink`'s default active-matching behavior for this route list.
- `tooltip` is now passed unconditionally (not `collapsed ? label : undefined` like the old `title=` attribute) — `SidebarMenuButton` internally hides the tooltip unless the sidebar is actually collapsed and not mobile (see its `hidden={state !== 'collapsed' || isMobile}` logic), so this is simpler and cannot show a stale tooltip in the expanded state.

- [ ] **Step 3: Update `frontend/src/layouts/DriveLayout.tsx`**

3a. In the icon import block near the top, remove `Menu` (no longer used — `SidebarTrigger` supplies its own icon):

```tsx
// Before
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

// After
import {
  Bell,
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

3b. Replace the `SidebarProvider` import and add the storage-helper import:

```tsx
// Before
import { SidebarProvider } from '@/components/drive/sidebar-context';

// After
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { getStoredSidebarCollapsed, setStoredSidebarCollapsed } from '@/lib/sidebar-storage';
```

3c. Remove the `sidebarOpen` state and replace it with controlled expanded state for the new provider. Find:

```tsx
  const [sidebarOpen, setSidebarOpen] = useState(false);
```

Delete that line, and add this near the other `useState` declarations (next to the `theme` state is a good spot, since it's the same kind of localStorage-backed UI preference):

```tsx
  const [sidebarExpanded, setSidebarExpanded] = useState(() => !getStoredSidebarCollapsed());
```

3d. Replace the sidebar provider open tag:

```tsx
// Before
    <SidebarProvider>

// After
    <SidebarProvider
      open={sidebarExpanded}
      onOpenChange={(open) => {
        setSidebarExpanded(open);
        setStoredSidebarCollapsed(!open);
      }}
    >
```

3e. Replace the entire desktop-wrapper + backdrop + mobile-drawer block with a single `AppSidebar` render. Find this whole block (the desktop `hidden lg:block` wrapper, the backdrop `div`, and the translating mobile drawer `div` with its close button):

```tsx
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

Replace it with just:

```tsx
          <AppSidebar user={user} storage={storage} breakdown={breakdown} onLogout={logout} />
```

3f. Replace the mobile hamburger button with `SidebarTrigger`. Find:

```tsx
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Open sidebar"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
```

Replace with:

```tsx
                  <SidebarTrigger variant="outline" size="icon" aria-label="Open sidebar" />
```

(`SidebarTrigger` forwards any extra props — including `variant`/`size` — onto its internal `Button` after its own defaults, so this reproduces the exact same outlined icon-button look the `Button` had. Its icon comes from `@hugeicons/react` instead of `lucide-react`'s `Menu` — an acceptable, intentional icon-library swap toward this project's configured `hugeicons` icon set, not a functional change.)

- [ ] **Step 4: Delete the now-unused custom sidebar context**

First confirm nothing still references it:

```bash
grep -rn "drive/sidebar-context" frontend/src
```

Expected: no output (both former consumers were rewritten in Steps 2–3). Then delete the file:

```bash
rm frontend/src/components/drive/sidebar-context.tsx
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

If there are errors, they will most likely be one of:
- A leftover reference to the removed `forceExpanded`/`onNavigate` props on `AppSidebar` — search for `<AppSidebar` in `DriveLayout.tsx` and confirm only the single call from Step 3e remains.
- An unused-import error for `Menu` or `Card` — confirm Step 3a removed `Menu` from `DriveLayout.tsx`'s import, and that `Card` is no longer imported in the rewritten `AppSidebar.tsx` (Step 2's replacement content has no `Card` import).

- [ ] **Step 6: Run the existing frontend test suite**

Run: `cd frontend && npm run test`
Expected: all existing tests pass, including `src/lib/sidebar-storage.test.ts` (untouched — `sidebar-storage.ts` itself is not modified by this plan, only consumed differently).

- [ ] **Step 7: Format**

Run: `cd frontend && npm run format`
Expected: exits cleanly; review the diff for any files it reformatted beyond what Steps 1–4 already changed.

- [ ] **Step 8: Manual verification in the browser**

With the frontend dev server running (`npm run dev` from `frontend/`, or the project's existing preview setup) and logged in:

1. At desktop width (≥1024px): confirm the sidebar renders expanded by default (or matches whatever was last persisted), with the logo/title, nav items with labels, and the footer showing avatar/name/email plus the storage breakdown block.
2. Click the header collapse toggle: sidebar shrinks to icon-only, nav item labels and the storage breakdown disappear, hovering a nav icon shows its tooltip with the item's label to the right.
3. Reload the page: the collapsed/expanded state from step 2 persists (confirms the `localStorage`-backed controlled `SidebarProvider` wiring from Step 3c/3d).
4. Press Cmd+B (or Ctrl+B on non-Mac): sidebar toggles collapse state.
5. Click through each nav item (All Files, Quota Tracker, Shared With Me, Recycle Bin, Activity Log, Setting, API Keys): each navigates and shows as active (highlighted) on its own page; "Starred" stays visibly disabled and does not navigate.
6. If logged in as an admin user, confirm the "Users" nav item appears and works; if not, confirm it's absent.
7. Click the footer avatar/name area: the profile dropdown opens with a "Log Out" item styled in the destructive/red treatment; clicking it logs out and redirects to `/login`.
8. Resize the browser to below 1024px width: the desktop rail disappears, the header hamburger (`SidebarTrigger`) appears; clicking it opens the Sheet drawer from the left showing the full expanded sidebar content (logo, labeled nav, full footer); clicking any nav item inside it both navigates and closes the drawer.

If any of these fail, fix the corresponding step's code before proceeding — do not commit with a known-broken behavior.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/hooks/use-mobile.ts frontend/src/components/ui/sidebar.tsx frontend/src/components/ui/sheet.tsx frontend/src/components/ui/separator.tsx frontend/src/components/ui/skeleton.tsx frontend/src/components/drive/AppSidebar.tsx frontend/src/layouts/DriveLayout.tsx
git rm frontend/src/components/drive/sidebar-context.tsx
git commit -m "$(cat <<'EOF'
refactor(sidebar): migrate to shadcn Sidebar primitives

Replaces the hand-rolled AppSidebar/sidebar-context implementation
(custom collapse context, manual mobile drawer, manual profile
dropdown) with shadcn's Sidebar component family, per the design in
docs/superpowers/specs/2026-07-27-sidebar-shadcn-design.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(The `ui/sheet.tsx`, `ui/separator.tsx`, `ui/skeleton.tsx` files were added as dependencies by the `npx shadcn@latest add sidebar` CLI run that preceded this plan and are staged here for the first time along with the rest of the migration.)
