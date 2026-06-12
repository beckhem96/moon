import fs from "node:fs";
import path from "node:path";
import {
  ArtifactSchema,
  MetricsFileSchema,
  type ArtifactWithAsset,
} from "./schema";

/**
 * 저장소 패턴 (04-plan §3): UI·도슨트·관광 코드는 이 인터페이스에만 의존한다.
 * 유물 100점+ 규모로 확장 시 JsonArtifactRepository를 DB 구현체로 교체.
 */
export interface ArtifactRepository {
  getAll(): ArtifactWithAsset[];
  getById(id: string): ArtifactWithAsset | null;
}

const CONTENT_DIR = path.join(process.cwd(), "content");

function loadAll(): ArtifactWithAsset[] {
  const artifactsDir = path.join(CONTENT_DIR, "artifacts");
  const metricsPath = path.join(CONTENT_DIR, "metrics.json");

  const metrics = MetricsFileSchema.parse(
    JSON.parse(fs.readFileSync(metricsPath, "utf-8")),
  );

  const items: ArtifactWithAsset[] = [];
  for (const file of fs.readdirSync(artifactsDir).filter((f) => f.endsWith(".json"))) {
    // 스키마 위반(출처표시 누락 등)은 빌드 실패로 이어진다 — 의도된 동작 (헌법 §1)
    const artifact = ArtifactSchema.parse(
      JSON.parse(fs.readFileSync(path.join(artifactsDir, file), "utf-8")),
    );
    const m = metrics[artifact.id];
    if (!m) {
      // 도메인 불변 규칙 2 (03-domain §4): publish를 거치지 않은 유물은 노출 불가
      console.warn(`[catalog] "${artifact.id}" 미발행(metrics 없음) — 카탈로그에서 제외`);
      continue;
    }
    const posterPath = `/models/${artifact.id}.jpg`;
    items.push({
      ...artifact,
      asset: {
        glbPath: `/models/${artifact.id}.glb`,
        posterPath: fs.existsSync(path.join(process.cwd(), "public", posterPath))
          ? posterPath
          : undefined,
        metrics: m,
      },
    });
  }
  return items.sort((a, b) => a.id.localeCompare(b.id));
}

class JsonArtifactRepository implements ArtifactRepository {
  private cache: ArtifactWithAsset[] | null = null;

  getAll(): ArtifactWithAsset[] {
    this.cache ??= loadAll();
    return this.cache;
  }

  getById(id: string): ArtifactWithAsset | null {
    return this.getAll().find((a) => a.id === id) ?? null;
  }
}

export const artifactRepository: ArtifactRepository = new JsonArtifactRepository();
