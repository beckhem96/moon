import { artifactRepository } from "@/src/catalog/repository";
import { posterOf, type ArtifactWithMedia, type ModelMedia } from "@/src/catalog/schema";
import { CATEGORY_SLUG, categoryRank, eraRank } from "@/src/catalog/taxonomy";
import { parseMaxCm } from "./scale";

/**
 * 02-spec F6 가상 전시관 — 분류별 **개별 방**으로 나눠 입장(성능) + 유물을 **실제 크기**로 전시.
 * 한 방에는 해당 분류 대표 ROOM_CAP점만 로드한다(과부하 방지). 전체는 카탈로그에서 노출.
 */

type ModelArtifact = ArtifactWithMedia & { asset: ModelMedia };

export const EYE_Y = 1.6; // 1인칭 시선 높이
const ROOM_CAP = 10; // 한 방에 로드하는 대표 유물 수
const WALL_X = 4.2; // 좌우 벽면 전시대 x
const CORRIDOR_HALF_X = 3.0; // 보행 가능 반폭
const ITEM_STEP_Z = 4.2; // 같은 벽 다음 전시대 z 간격
const FIRST_Z = 1.5; // 첫 전시대 z
const ENTRANCE_Z = -3.5;
const FALLBACK_CM = 30; // 치수 미상 유물의 기본 표시 크기

export interface RoomPlacement {
  artifactId: string;
  title: string;
  glbPath: string;
  realCm: number; // 실제 최대 치수(cm) — 미상 시 FALLBACK_CM
  hasDim: boolean;
  position: [number, number, number];
  rotationY: number;
}

export interface RoomSummary {
  category: string;
  slug: string;
  count: number; // 분류 전체 모델 수
  shown: number; // 방에 전시되는 수(대표)
  posterPath?: string;
  totalSizeMB: number;
}

export interface ExhibitionRoom {
  category: string;
  slug: string;
  count: number;
  shown: number;
  totalSizeMB: number;
  placements: RoomPlacement[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawn: { position: [number, number, number]; yaw: number };
}

const isCurated = (id: string) => !id.startsWith("nmk-");

/** 분류별 모델 유물(이미지 전용 제외) */
function modelsByCategory(category: string): ModelArtifact[] {
  return artifactRepository
    .getAll()
    .filter((a): a is ModelArtifact => a.asset.kind === "model" && a.category === category);
}

/** 대표 선정: 큐레이션 원본 > featured > 가벼운 용량, 배치는 시대순 */
function representatives(pool: ModelArtifact[], n: number): ModelArtifact[] {
  return [...pool]
    .sort(
      (x, y) =>
        (isCurated(y.id) ? 1 : 0) - (isCurated(x.id) ? 1 : 0) ||
        (y.featured ? 1 : 0) - (x.featured ? 1 : 0) ||
        x.asset.metrics.publishedSizeMB - y.asset.metrics.publishedSizeMB,
    )
    .slice(0, n)
    .sort((x, y) => eraRank(x.era) - eraRank(y.era));
}

/** 로비: 모델 유물이 있는 분류별 요약 */
export function listRooms(): RoomSummary[] {
  const all = artifactRepository.getAll().filter((a) => a.asset.kind === "model");
  const cats = [...new Set(all.map((a) => a.category))].sort((a, b) => categoryRank(a) - categoryRank(b));
  return cats.map((category) => {
    const pool = modelsByCategory(category);
    const chosen = representatives(pool, ROOM_CAP);
    return {
      category,
      slug: CATEGORY_SLUG[category] ?? category,
      count: pool.length,
      shown: chosen.length,
      posterPath: posterOf(chosen[0] ?? pool[0]),
      totalSizeMB: Math.round(chosen.reduce((s, a) => s + a.asset.metrics.publishedSizeMB, 0) * 10) / 10,
    };
  });
}

/** 단일 분류 방 — 대표 유물을 좌우 2열로 배치, 실제 크기(realCm) 포함 */
export function getRoom(category: string): ExhibitionRoom | null {
  const pool = modelsByCategory(category);
  if (pool.length === 0) return null;
  const chosen = representatives(pool, ROOM_CAP);

  const placements: RoomPlacement[] = chosen.map((a, i) => {
    const onLeft = i % 2 === 0;
    const row = Math.floor(i / 2);
    const cm = parseMaxCm(a.dimensions);
    return {
      artifactId: a.id,
      title: a.title,
      glbPath: a.asset.glbPath,
      realCm: cm ?? FALLBACK_CM,
      hasDim: cm != null,
      position: [onLeft ? -WALL_X : WALL_X, 0, FIRST_Z + row * ITEM_STEP_Z],
      rotationY: onLeft ? Math.PI / 2 : -Math.PI / 2,
    };
  });

  const rows = Math.ceil(chosen.length / 2);
  const maxZ = FIRST_Z + Math.max(rows - 1, 0) * ITEM_STEP_Z + 2.5;

  return {
    category,
    slug: CATEGORY_SLUG[category] ?? category,
    count: pool.length,
    shown: chosen.length,
    totalSizeMB: Math.round(chosen.reduce((s, a) => s + a.asset.metrics.publishedSizeMB, 0) * 10) / 10,
    placements,
    bounds: { minX: -CORRIDOR_HALF_X, maxX: CORRIDOR_HALF_X, minZ: ENTRANCE_Z, maxZ },
    spawn: { position: [0, EYE_Y, ENTRANCE_Z], yaw: 0 },
  };
}
