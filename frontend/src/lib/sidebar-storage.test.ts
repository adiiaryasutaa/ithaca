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
