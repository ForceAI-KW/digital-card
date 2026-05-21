// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { check } from '../rate-limit';

describe('rate-limit.check', () => {
  it('allows the first N attempts', () => {
    for (let i = 0; i < 5; i++) expect(check('ip1', 5, 60_000)).toBe(true);
  });
  it('blocks the (N+1)th attempt', () => {
    for (let i = 0; i < 5; i++) check('ip2', 5, 60_000);
    expect(check('ip2', 5, 60_000)).toBe(false);
  });
  it('isolates buckets by key', () => {
    for (let i = 0; i < 5; i++) check('ip3', 5, 60_000);
    expect(check('ip4', 5, 60_000)).toBe(true);
  });
});
