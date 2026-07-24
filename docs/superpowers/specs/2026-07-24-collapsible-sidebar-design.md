# Collapsible Desktop Sidebar — Design

## Goal

Add a shadcn-style collapsible sidebar to Ithaca's `DriveLayout`. On large
screens (`lg:` and up), the user can collapse the sidebar to an icon-only
rail and expand it back. Mobile behavior (the existing slide-in overlay
drawer) is unchanged.

## Constraints / decisions

- **No `radix-ui` dependency.** The project's `components/ui/*` primitives
  are built on `@base-ui/react`, not Radix (see `CLAUDE.md`). shadcn's
  official `sidebar.tsx` registry item depends on `radix-ui` (Sheet,
  Tooltip, Separator). We adapt the pattern instead of installing it
  as-is: reuse the project's existing `components/ui/tooltip.tsx`
  (Base UI) for collapsed-state label tooltips, and plain `<div>` borders
  for separators. No new npm dependency.
- **Collapse mode: icon rail**, not offcanvas. Collapsed sidebar stays
  visible as a narrow icon strip; nav items keep their icons, labels
  become hover tooltips. This was chosen over fully hiding the sidebar
  because the mobile drawer already covers the "hide it completely" case.
- **Mobile untouched.** The current `sidebarOpen` translate-x overlay in
  `DriveLayout.tsx` (lines ~508-538) already works and is a separate
  concern from desktop collapse. Only the desktop static sidebar
  (`hidden lg:block` block) gains collapse behavior.

## Architecture

A new `SidebarProvider` React context wraps `DriveLayout`'s return value,
exposing:

```ts
{ collapsed: boolean; toggleCollapsed: () => void }
```

State is initialized from `localStorage.getItem('ithaca:sidebar-collapsed')`
(boolean, default `false`/expanded) and written back on every toggle —
same persistence pattern already used for `ithaca:theme` in
`DriveLayout.tsx`. No cookie, no SSR concern (this is a client-only Vite
SPA).

## Components

- `frontend/src/components/drive/sidebar-context.tsx` — new file.
  `SidebarProvider`, `useSidebar()` hook.
- `frontend/src/components/drive/AppSidebar.tsx` — new file. The existing
  inline `Sidebar` function currently defined inside
  `frontend/src/layouts/DriveLayout.tsx` (lines ~143-331) moves here
  unchanged in its expanded-state rendering, plus new collapsed-state
  rendering:
  - **Expanded** (`w-64`): identical to today's look — logo + wordmark,
    nav list with icon+label, admin "Users" link, footer `Card` with
    avatar/name/email/logout-menu and the Photo/Video/Document/Free
    Storage breakdown + progress bar.
  - **Collapsed** (`w-16`): logo icon only (wordmark hidden); nav items
    become centered `h-10 w-10` icon buttons, active/hover states
    unchanged, label shown via `Tooltip` (side="right") on hover/focus;
    the disabled "Starred" item and the conditional admin "Users" link
    follow the same icon-only + tooltip treatment; footer collapses to
    just the avatar (click still opens the logout dropdown, anchored
    so it doesn't clip off-screen) — name/email/storage breakdown/progress
    bar are hidden while collapsed.
  - A toggle button (chevron icon, `PanelLeftClose`/`PanelLeftOpen` from
    `lucide-react`) sits in the sidebar's own top row next to the logo.
    Clicking it calls `toggleCollapsed()`.
- `frontend/src/layouts/DriveLayout.tsx` — updated to: wrap its JSX in
  `SidebarProvider`, import and render `AppSidebar` in place of the old
  inline `Sidebar` (both the desktop static instance and the mobile
  overlay instance — the mobile instance always renders in its expanded
  form regardless of `collapsed`, since it's an overlay the user
  explicitly opened), and drop the now-moved `Sidebar` function and its
  now-unused imports.

## Interaction details

- Width transition: `transition-[width] duration-200` on the desktop
  `<aside>` element, animating between `16rem` (expanded) and `4rem`
  (collapsed).
- Keyboard shortcut: `Ctrl+B` / `Cmd+B` calls `toggleCollapsed()` globally
  (harmless no-op visually below the `lg` breakpoint, matching shadcn's
  own convention). Registered via a `useEffect` `keydown` listener in
  `SidebarProvider`, guarded so it doesn't fire while focus is inside a
  text input (`e.target` is `INPUT`/`TEXTAREA`/`[contenteditable]`).
- Active-route highlighting logic (`NavLink` + `isActive` classNames)
  is unchanged — only the layout/label visibility differs between the
  two render modes.

## Data flow

Purely client-side UI state. No backend/schema/API changes.

## Error handling

None needed beyond a safe `localStorage` read (invalid/missing value
falls back to expanded, matching the existing theme-state pattern).

## Testing / verification

- `npm run build` (or `tsc --noEmit`) in `frontend/` — must stay clean.
- Manual verification in the browser preview at a `lg`+ viewport width:
  - Toggle collapse/expand via the sidebar button; confirm smooth width
    transition and no layout shift/overflow in the content area.
  - Hover a collapsed nav icon — tooltip shows the correct label.
  - Confirm active-route highlighting still works in both modes.
  - Confirm `Ctrl/Cmd+B` toggles collapse, and does nothing unwanted
    while typing in the search box or other inputs.
  - Confirm collapsed state persists across a page reload.
  - Resize below `lg` — mobile hamburger/overlay drawer still opens and
    closes exactly as before, unaffected by the collapsed flag.
