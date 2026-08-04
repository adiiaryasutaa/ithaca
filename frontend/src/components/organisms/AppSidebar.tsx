import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Braces,
  FileArchive,
  Gauge,
  HardDrive,
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
import { BrandLogo } from '@/components/atoms/BrandLogo';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  // Per-account rows returned alongside the totals by GET /storage/summary.
  accounts?: {
    id: string;
    provider: string;
    email: string;
    status: string;
    totalBytes: string | null;
    usedBytes: string;
    availableBytes: string | null;
    lastSyncedAt: string | null;
  }[];
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

  const storageBreakdown = (
    <>
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
    </>
  );

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
        {collapsed ? (
          <Popover>
            <PopoverTrigger className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground">
              <HardDrive className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent side="right" align="end" className="w-64 gap-2 p-3 text-[13px]">
              {storageBreakdown}
            </PopoverContent>
          </Popover>
        ) : (
          <Card className="gap-2 p-3 text-[13px]">{storageBreakdown}</Card>
        )}

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
