import { describe, it, expect } from 'vitest';
import { formatBytes } from './api';

describe('formatBytes', () => {
  it('returns -- for null/undefined', () => {
    expect(formatBytes(null)).toBe('--');
    expect(formatBytes(undefined)).toBe('--');
  });

  it('returns -- for non-finite input', () => {
    expect(formatBytes('not-a-number')).toBe('--');
    expect(formatBytes(Infinity)).toBe('--');
  });

  it('formats zero as 0 B', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes with no decimals', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('scales through KB/MB/GB/TB with two decimals', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.50 GB');
    expect(formatBytes(2 * 1024 ** 4)).toBe('2.00 TB');
  });

  it('caps the unit at TB for very large values', () => {
    expect(formatBytes(1024 ** 6)).toContain('TB');
  });

  it('accepts string and bigint inputs', () => {
    expect(formatBytes('2048')).toBe('2.00 KB');
    expect(formatBytes(1024n)).toBe('1.00 KB');
  });
});
