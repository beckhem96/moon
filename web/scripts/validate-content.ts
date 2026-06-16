/** 콘텐츠 무결성 검증 — prebuild 훅으로 실행되어 스키마 위반 시 빌드를 실패시킨다 (헌법 §1) */
import { artifactRepository } from "../src/catalog/repository";

try {
  const items = artifactRepository.getAll();
  const models = items.filter((a) => a.asset.kind === "model");
  const images = items.length - models.length;
  console.log(`✓ 콘텐츠 검증 통과 — 발행 유물 ${items.length}점 (3D ${models.length} · 이미지 ${images})`);
  for (const a of items) {
    if (a.asset.kind !== "model") continue;
    const m = a.asset.metrics;
    const flag = m.publishedSizeMB > 5 ? " ⚠ B1 목표(5MB) 초과" : "";
    console.log(
      `  - ${a.id}: ${m.publishedSizeMB}MB (원본 ${m.sourceSizeMB}MB, -${m.reductionPct}%)${flag}`,
    );
  }
} catch (e) {
  console.error("✗ 콘텐츠 검증 실패:", e instanceof Error ? e.message : e);
  process.exit(1);
}
