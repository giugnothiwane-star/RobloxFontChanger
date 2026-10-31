export type SemVer = readonly [number, number, number];

export function parseSemver(v: string): SemVer | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareSemver(a: SemVer, b: SemVer): number {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Sous-ensemble volontairement réduit de npm-semver : *, x.y.z, ^, ~, >=a [<b]. */
export function satisfies(version: string, range: string): boolean {
  const v = parseSemver(version);
  if (!v) return false;
  const r = range.trim();
  if (r === '*') return true;
  const caret = /^\^(.+)$/.exec(r);
  const tilde = /^~(.+)$/.exec(r);
  const span = /^>=(\S+)(?: <(\S+))?$/.exec(r);
  if (caret?.[1]) {
    const base = parseSemver(caret[1]);
    if (!base) return false;
    // Sémantique npm : ^0.y.z verrouille la mineure, ^x verrouille la majeure.
    const upper: SemVer = base[0] > 0 ? [base[0] + 1, 0, 0] : [0, base[1] + 1, 0];
    return compareSemver(v, base) >= 0 && compareSemver(v, upper) < 0;
  }
  if (tilde?.[1]) {
    const base = parseSemver(tilde[1]);
    if (!base) return false;
    return compareSemver(v, base) >= 0 && compareSemver(v, [base[0], base[1] + 1, 0]) < 0;
  }
  if (span?.[1]) {
    const lo = parseSemver(span[1]);
    const hi = span[2] ? parseSemver(span[2]) : null;
    if (!lo || (span[2] && !hi)) return false;
    return compareSemver(v, lo) >= 0 && (!hi || compareSemver(v, hi) < 0);
  }
  const exact = parseSemver(r);
  return exact ? compareSemver(v, exact) === 0 : false;
}
