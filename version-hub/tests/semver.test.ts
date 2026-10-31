import { satisfies, parseSemver } from '@/utils/semver';

describe('semver', () => {
  it('analyse et refuse les formats invalides', () => {
    expect(parseSemver('1.2.3')).toEqual([1, 2, 3]);
    expect(parseSemver('1.2')).toBeNull();
    expect(parseSemver('v1.2.3')).toBeNull();
  });
  it.each([
    ['1.4.0', '^1.0.0', true],
    ['2.0.0', '^1.0.0', false],
    ['0.2.5', '^0.2.0', true],
    ['0.3.0', '^0.2.0', false],
    ['1.2.9', '~1.2.0', true],
    ['1.3.0', '~1.2.0', false],
    ['1.0.0', '1.0.0', true],
    ['1.0.1', '1.0.0', false],
    ['1.5.0', '>=1.0.0 <2.0.0', true],
    ['2.0.0', '>=1.0.0 <2.0.0', false],
    ['9.9.9', '*', true],
    ['abc', '*', false],
    ['1.0.0', 'garbage', false],
  ])('%s satisfait %s → %s', (v, r, ok) => expect(satisfies(v, r)).toBe(ok));
});
