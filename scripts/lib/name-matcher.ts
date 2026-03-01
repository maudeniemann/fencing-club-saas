// Tiered name matching: exact → normalized → fuzzy (Levenshtein)

export interface MemberInfo {
  id: string;
  display_name: string;
  role: string;
}

export interface MatchResult {
  member: MemberInfo;
  confidence: 'exact' | 'normalized' | 'fuzzy';
  distance: number;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove parenthetical content: "Alexander (Sasha) Khotline" → "Alexander Khotline"
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    // Take first part of slash-separated names: "Muzhou/Joe Wang" → "Muzhou Wang"
    .replace(/(\w+)\/\w+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    // Strip accents/diacritics
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

export class NameMatcher {
  private exactMap: Map<string, MemberInfo> = new Map();
  private normalizedMap: Map<string, MemberInfo> = new Map();
  private allMembers: MemberInfo[] = [];

  constructor(members: MemberInfo[]) {
    this.allMembers = members;
    for (const m of members) {
      this.exactMap.set(m.display_name, m);
      this.normalizedMap.set(normalize(m.display_name), m);
    }
  }

  match(scrapedName: string, roleFilter?: string): MatchResult | null {
    // Tier 1: Exact match
    const exact = this.exactMap.get(scrapedName);
    if (exact && (!roleFilter || exact.role === roleFilter)) {
      return { member: exact, confidence: 'exact', distance: 0 };
    }

    // Tier 2: Normalized match
    const norm = normalize(scrapedName);
    const normalized = this.normalizedMap.get(norm);
    if (normalized && (!roleFilter || normalized.role === roleFilter)) {
      return { member: normalized, confidence: 'normalized', distance: 0 };
    }

    // Tier 3: Fuzzy match (Levenshtein distance <= 2)
    let bestMatch: MemberInfo | null = null;
    let bestDistance = Infinity;

    const candidates = roleFilter
      ? this.allMembers.filter((m) => m.role === roleFilter)
      : this.allMembers;

    for (const m of candidates) {
      const dist = levenshtein(norm, normalize(m.display_name));
      if (dist < bestDistance) {
        bestDistance = dist;
        bestMatch = m;
      }
    }

    if (bestMatch && bestDistance <= 2) {
      return { member: bestMatch, confidence: 'fuzzy', distance: bestDistance };
    }

    return null;
  }
}
