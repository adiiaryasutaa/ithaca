const SIDEBAR_COLLAPSED_KEY = 'ithaca:sidebar-collapsed';

export function getStoredSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
}

export function setStoredSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? 'true' : 'false');
}
