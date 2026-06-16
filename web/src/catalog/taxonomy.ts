/**
 * 시대·분류(유물 특징) 공용 분류 체계 (02-spec F2 / 03-domain 용어집).
 * 카탈로그 필터·정렬과 가상 전시관 구역(zone) 배치가 이 한 곳을 진실의 원천으로 공유한다.
 */

/** 연대순 — 카탈로그 시대 정렬·전시관 구역 내 정렬의 기준 */
export const ERA_ORDER = [
  "신석기",
  "청동기",
  "초기철기",
  "낙랑",
  "삼국시대",
  "신라",
  "통일신라",
  "고려",
  "조선",
] as const;

/** 유물 특징(분류) — 채택 5분류. 전시관 구역 순서이기도 하다. */
export const CATEGORY_ORDER = [
  "토기·도기",
  "청동기",
  "금속공예·장신구",
  "불교조각",
  "도자기",
] as const;

export type Category = (typeof CATEGORY_ORDER)[number];

const NOT_FOUND = 999;

/** 미상·미등록 시대는 목록 끝으로 */
export function eraRank(era: string): number {
  const i = (ERA_ORDER as readonly string[]).indexOf(era);
  return i === -1 ? NOT_FOUND : i;
}

export function categoryRank(category: string): number {
  const i = (CATEGORY_ORDER as readonly string[]).indexOf(category);
  return i === -1 ? NOT_FOUND : i;
}

/** 정렬 키가 같은 값을 안정적으로 줄세우기 위한 비교자 */
export function byEra<T extends { era: string }>(a: T, b: T): number {
  return eraRank(a.era) - eraRank(b.era);
}

/** 주어진 시대 목록을 연대순으로 (미등록 시대는 원래 순서 유지하며 뒤로) */
export function sortEras(eras: string[]): string[] {
  return [...eras].sort((a, b) => eraRank(a) - eraRank(b));
}

/** 주어진 분류 목록을 채택 순서로 */
export function sortCategories(categories: string[]): string[] {
  return [...categories].sort((a, b) => categoryRank(a) - categoryRank(b));
}
