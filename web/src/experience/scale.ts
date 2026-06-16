/** "높이 46cm, 몸통지름 46cm…" 같은 치수 문자열에서 최대 cm 값을 뽑아 실제 크기 비교에 쓴다. */
export function parseMaxCm(dimensions?: string): number | null {
  if (!dimensions) return null;
  const nums = [...dimensions.matchAll(/(\d+(?:\.\d+)?)\s*cm/gi)].map((m) => parseFloat(m[1]));
  const valid = nums.filter((n) => Number.isFinite(n) && n > 0);
  return valid.length ? Math.max(...valid) : null;
}
