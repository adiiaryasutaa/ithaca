# Sidebar migration to shadcn Sidebar primitives

## Context

`AppSidebar.tsx` is a hand-rolled sidebar: its own `SidebarProvider`/`useSidebar`
context (`sidebar-context.tsx`, localStorage-backed collapse state, custom
Cmd/Ctrl+B listener), a manually built desktop collapsible-icon rail, a
manually built mobile drawer (fixed-position overlay + translate transform,
implemented separately in `DriveLayout.tsx`), and a hand-rolled profile
dropdown (manual `ref` + `mousedown`/`Escape` listeners instead of a menu
primitive).

shadcn ships an official `Sidebar` component family (`SidebarProvider`,
`Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`,
`SidebarMenuButton`, `SidebarFooter`, `SidebarRail`, `SidebarTrigger`,
`useSidebar`) that already handles icon-collapse, a mobile Sheet drawer, and a
Cmd/Ctrl+B shortcut internally. This spec replaces the custom implementation
with it.

## Goal

Full architectural swap: adopt shadcn's Sidebar primitives for both desktop
(icon-collapsible rail) and mobile (Sheet drawer), removing the parallel
hand-rolled implementation, while preserving every piece of app-specific
content and behavior (nav items, admin-only link, storage breakdown, profile
menu, active-link highlighting, localStorage-persisted collapse state).

## Non-goals

- No visual redesign beyond what naturally falls out of adopting the new
  primitives (spacing/tooltip affordances). Colors, fonts, and the existing
  semantic token usage are unchanged.
- No RTL work (`components.json` has `"rtl": false`; not in scope).
- No changes to nav destinations, auth, storage/quota data fetching, or any
  business logic in `DriveLayout.tsx` outside the sidebar shell itself.

## Architecture

### New files (via `npx shadcn@latest add sidebar` from `frontend/`)

- `frontend/src/components/ui/sidebar.tsx` — generated for this project's
  `base-mira` / Base UI style, consistent with the existing Base UI
  `DropdownMenu` (`@base-ui/react/menu`), not Radix.
- `frontend/src/hooks/use-mobile.ts` — mobile breakpoint hook shadcn's
  `Sidebar` depends on for switching to the Sheet drawer.

### Changed files

- `frontend/src/components/drive/AppSidebar.tsx` — rewritten on top of the
  new primitives (see Component mapping below).
- `frontend/src/layouts/DriveLayout.tsx`:
  - Swap the `SidebarProvider` import from `@/components/drive/sidebar-context`
    to the new `@/components/ui/sidebar`.
  - Delete the hand-rolled mobile overlay + drawer block (the `sidebarOpen`
    backdrop `div`, the translating drawer `div`, and its close button) —
    roughly the current lines 288–319.
  - Remove the `sidebarOpen` state and its setter.
  - Replace the mobile header's `<Button onClick={() => setSidebarOpen(true)}>`
    hamburger with `<SidebarTrigger>`.
  - Drop the `onNavigate` prop passed to `AppSidebar` (see State section).
  - Collapse the two `<AppSidebar ... />` call sites (desktop `hidden lg:block`
    wrapper + mobile `forceExpanded` wrapper) into a single call — shadcn's
    `Sidebar` renders itself correctly for both contexts from one tree.

### Deleted files

- `frontend/src/components/drive/sidebar-context.tsx` — fully superseded by
  shadcn's own provider/hook.

### Kept as-is

- `frontend/src/lib/sidebar-storage.ts` — `getStoredSidebarCollapsed` /
  `setStoredSidebarCollapsed`, reused for controlled persistence.

## Component mapping

| Today (custom) | Becomes (shadcn) |
|---|---|
| `<aside className="... w-16/w-64 ...">` | `<Sidebar collapsible="icon" side="left">` (plain bordered `variant="sidebar"`, not floating/inset — matches current flush-left, `border-r` look) |
| Logo + title + collapse button block | `<SidebarHeader>`. Title text hidden when collapsed via the same `group-data-[collapsible=icon]:hidden` pattern already used in shadcn's docs. |
| Collapse/expand icon button (`PanelLeftOpen`/`PanelLeftClose` swap) | Custom button built with `useSidebar()` + `toggleSidebar()` inside `SidebarHeader`, **not** the default `SidebarTrigger` — preserves the current two-icon swap instead of shadcn's single default icon. |
| `<nav>` with mapped menu items | `<SidebarContent><SidebarGroup><SidebarGroupContent><SidebarMenu>` |
| Each nav `NavLink`/disabled `button` | `<SidebarMenuItem><SidebarMenuButton asChild tooltip={item.label} isActive={...}>` wrapping the `NavLink` (tooltip prop replaces the manual `title=` attribute used today for collapsed icon-only mode — same UX, provided by the primitive). Disabled "Starred" item keeps a plain non-interactive `<SidebarMenuButton disabled>` with existing opacity/cursor styling. |
| Admin-only "Users" `NavLink` | Same pattern, conditionally rendered on `user?.role === 'admin'`, unchanged condition. |
| Bottom `Card` (avatar, name/email, storage breakdown, progress bar) | `<SidebarFooter>` containing: (a) the storage breakdown block, wrapped so it's hidden when collapsed via `group-data-[collapsible=icon]:hidden` (same visibility rule as today's `!collapsed` check), and (b) a `<SidebarMenu><SidebarMenuItem>` with `<SidebarMenuButton size="lg" asChild>` as a `DropdownMenuTrigger` (avatar + name + email), paired with `<DropdownMenuContent>` containing the "Log Out" item — using the project's existing `@/components/ui/dropdown-menu` (Base UI), replacing the manual `ref`/`mousedown`/`Escape` listener implementation. |
| (none) | `<SidebarRail>` added inside `<Sidebar>` — shadcn's free drag-handle affordance on the sidebar's edge for toggling. Low cost, part of the standard composition. |

## State & data flow

- **Collapse persistence:** `SidebarProvider` is used in controlled mode —
  `open`/`onOpenChange` wired to `getStoredSidebarCollapsed()` /
  `setStoredSidebarCollapsed()` from `lib/sidebar-storage.ts`. Note the
  polarity flip: shadcn's `open` means *expanded*, so `open = !collapsed` and
  `onOpenChange={(nextOpen) => setStoredSidebarCollapsed(!nextOpen)}`. This
  keeps the same localStorage key/format the app already uses (matches the
  existing `ithaca:theme` pattern of client-persisted UI prefs — no cookie
  introduced, since this is a pure Vite SPA with no SSR).
- **Keyboard shortcut:** shadcn's `SidebarProvider` provides its own
  Cmd/Ctrl+B handling internally. The custom `window.addEventListener`
  version in `sidebar-context.tsx` is deleted along with that file — same
  shortcut, no user-facing change.
- **Mobile breakpoint:** shadcn's generated `use-mobile.ts` defaults to
  768px. This app's existing desktop/mobile split is Tailwind's `lg:`
  (1024px) throughout `DriveLayout.tsx`. Edit the generated hook's
  `MOBILE_BREAKPOINT` constant from `768` to `1024` so the sidebar's
  collapse-rail/Sheet-drawer switch happens at the same width the rest of
  the layout already switches at.
- **`forceExpanded` prop removed:** today `AppSidebar` takes a
  `forceExpanded` prop used only by the mobile drawer call site (so the
  drawer always shows the full expanded layout regardless of desktop
  collapse state). shadcn's mobile Sheet already always renders the full
  sidebar content regardless of the desktop `collapsible="icon"` state, so
  this prop and both special-cased call sites go away — one `<AppSidebar />`
  render handles both contexts.
- **Closing the mobile drawer on navigate:** today `DriveLayout` passes
  `onNavigate={() => setSidebarOpen(false)}` into `AppSidebar`, called from
  each nav link's `onClick`. shadcn's Sheet doesn't auto-close on an inner
  link click, so `AppSidebar` now calls `useSidebar().setOpenMobile(false)`
  directly from each nav item's click handler, replicating the same
  behavior without `DriveLayout` needing to pass anything in.

## Error handling / edge cases

- `useSidebar()` still throws if called outside `SidebarProvider` — same
  invariant as today's custom hook, unchanged risk surface.
- Disabled "Starred" item and the admin-gated "Users" item preserve their
  exact current conditions — no behavior change, only the wrapping
  component changes.
- Avatar/Gravatar fetching, storage-summary/breakdown fetching, logout flow,
  and all other business logic in `DriveLayout.tsx` are untouched by this
  refactor — it is scoped to the sidebar's presentational shell only.

## Testing / verification

- `npx tsc --noEmit` in `frontend/` after the rewrite.
- Manual check in the running native dev preview (already up on
  `localhost:5173`), covering:
  - Desktop collapse/expand toggle, and that the collapsed/expanded state
    survives a page reload (localStorage).
  - Cmd/Ctrl+B toggles collapse.
  - Active-link highlighting unchanged across all nav items.
  - Admin-only "Users" link present only for `role === 'admin'`.
  - Disabled "Starred" item stays inert (no navigation, no active state).
  - Profile dropdown opens/closes correctly and "Log Out" logs the user out.
  - Mobile width (resize to below 1024px): hamburger opens the Sheet
    drawer, clicking a nav link closes it.
  - Storage breakdown block (Photo/Video/Document/Free Storage, used/total,
    progress bar) renders identically in the expanded state, hidden when
    collapsed.
  - Hovering collapsed icon-only nav items shows the tooltip with the
    item's label.
