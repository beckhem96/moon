import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { artifactRepository } from "@/src/catalog/repository";
import { categoryRank, eraRank } from "@/src/catalog/taxonomy";

/**
 * 03-domain §4 Exhibition 애그리거트 — 등록된 유물만 배치(불변 규칙 4).
 * 02-spec F6: 분류(category)별 구역(zone)으로 나뉜 복도형 전시실을 코드로 생성한다.
 * 유물 배치는 저장소 + 분류 체계(taxonomy)에서 자동 파생되므로 유물 추가 시 자동 반영된다.
 */

const ExhibitionMetaSchema = z.object({
  id: z.string(),
  title: z.string(),
  theme: z.string(),
});

// 복도형 레이아웃 상수 (단위: m, 정규화 유물 반경 1 기준)
export const EYE_Y = 1.6; // 1인칭 시선 높이
const WALL_X = 4.5; // 좌우 벽면 전시대 x 오프셋
const CORRIDOR_HALF_X = 3.2; // 관람객이 다닐 수 있는 복도 반폭
const ITEM_STEP_Z = 4.5; // 같은 벽에서 다음 전시대까지 z 간격
const ZONE_PAD_Z = 3; // 구역 입구 표지 ~ 첫 전시대 여백
const ZONE_GAP_Z = 2.5; // 구역 사이 복도 여백
const ENTRANCE_Z = -4; // 입장 지점(첫 구역 앞)

export interface ExhibitPlacement {
  artifactId: string;
  title: string;
  category: string;
  glbPath: string;
  publishedSizeMB: number;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

export interface ExhibitionZone {
  category: string;
  count: number;
  signPosition: [number, number, number];
  startZ: number;
  endZ: number;
}

export interface ResolvedExhibition {
  id: string;
  title: string;
  theme: string;
  placements: ExhibitPlacement[];
  zones: ExhibitionZone[];
  totalSizeMB: number;
  hallLength: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawn: { position: [number, number, number]; yaw: number };
}

function readMeta(): z.infer<typeof ExhibitionMetaSchema> {
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "content", "exhibitions.json"), "utf-8"),
  );
  return z.array(ExhibitionMetaSchema).min(1).parse(raw)[0];
}

/**
 * 분류 → 전시 대표 유물 묶음(시대순). 등록·발행된 유물만 포함.
 * 카탈로그는 전 유물(130점+)을 노출하지만, 가상 전시관은 한 3D 씬에 모든 GLB를 동시 로드하면
 * 과부하이므로 분류별 대표 EXHIBIT_PER_CATEGORY점만 선별한다(성능 예산·모바일 배려).
 * 선정 우선순위: 큐레이션된 원본 14점(비 nmk-) > featured > 가벼운 용량.
 */
const EXHIBIT_PER_CATEGORY = 4;
const isCurated = (id: string) => !id.startsWith("nmk-");

function groupByCategory() {
  const all = artifactRepository.getAll();
  const present = [...new Set(all.map((a) => a.category))].sort(
    (a, b) => categoryRank(a) - categoryRank(b),
  );
  // categoryRank가 CATEGORY_ORDER를 인코딩하며, 미등록 분류(확장 시)는 뒤로 정렬된다
  return present.map((category) => {
    const pool = all.filter((a) => a.category === category);
    const chosen = [...pool]
      .sort(
        (x, y) =>
          (isCurated(y.id) ? 1 : 0) - (isCurated(x.id) ? 1 : 0) ||
          (y.featured ? 1 : 0) - (x.featured ? 1 : 0) ||
          x.asset.metrics.publishedSizeMB - y.asset.metrics.publishedSizeMB,
      )
      .slice(0, EXHIBIT_PER_CATEGORY)
      .sort((x, y) => eraRank(x.era) - eraRank(y.era)); // 배치는 시대순
    return { category, items: chosen };
  });
}

export function getExhibitions(): ResolvedExhibition[] {
  const meta = readMeta();
  const grouped = groupByCategory();

  const placements: ExhibitPlacement[] = [];
  const zones: ExhibitionZone[] = [];
  let cursorZ = ENTRANCE_Z + ZONE_GAP_Z; // 첫 구역 시작 z

  for (const { category, items } of grouped) {
    const startZ = cursorZ;
    const pairs = Math.ceil(items.length / 2);

    items.forEach((a, i) => {
      const pair = Math.floor(i / 2);
      const onLeft = i % 2 === 0;
      placements.push({
        artifactId: a.id,
        title: a.title,
        category,
        glbPath: a.asset.glbPath,
        publishedSizeMB: a.asset.metrics.publishedSizeMB,
        position: [onLeft ? -WALL_X : WALL_X, 0, startZ + ZONE_PAD_Z + pair * ITEM_STEP_Z],
        rotationY: onLeft ? Math.PI / 2 : -Math.PI / 2, // 복도 안쪽(중앙)을 바라보게
        scale: 1.1,
      });
    });

    const endZ = startZ + ZONE_PAD_Z + Math.max(pairs - 1, 0) * ITEM_STEP_Z + ZONE_PAD_Z;
    zones.push({
      category,
      count: items.length,
      signPosition: [0, 2.6, startZ], // 구역 입구 상단 표지
      startZ,
      endZ,
    });
    cursorZ = endZ + ZONE_GAP_Z;
  }

  const hallLength = cursorZ;
  const totalSizeMB =
    Math.round(placements.reduce((s, p) => s + p.publishedSizeMB, 0) * 10) / 10;

  return [
    {
      id: meta.id,
      title: meta.title,
      theme: meta.theme,
      placements,
      zones,
      totalSizeMB,
      hallLength,
      bounds: {
        minX: -CORRIDOR_HALF_X,
        maxX: CORRIDOR_HALF_X,
        minZ: ENTRANCE_Z,
        maxZ: hallLength - ZONE_GAP_Z,
      },
      spawn: { position: [0, EYE_Y, ENTRANCE_Z], yaw: 0 }, // +Z(복도 안쪽)을 바라봄
    },
  ];
}

export function getExhibition(id: string): ResolvedExhibition | null {
  return getExhibitions().find((e) => e.id === id) ?? null;
}
