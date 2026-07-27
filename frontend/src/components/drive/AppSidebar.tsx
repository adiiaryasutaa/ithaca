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

      {(() => {
        const profile = (
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
        );

        if (collapsed) {
          return <div className="mt-auto pb-1">{profile}</div>;
        }

        return (
          <Card size="sm" className="mt-auto text-[13px] !overflow-visible">
            {profile}
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
          </Card>
        );
      })()}
    </aside>
  );
}
