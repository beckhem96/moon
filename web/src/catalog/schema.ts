import { z } from "zod";

/** 공공누리 유형 (01-constitution §1: 유형·제공기관·원천 URL 없는 유물은 등록 불가) */
export const AttributionSchema = z.object({
  kogl: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  provider: z.string().min(1),
  sourceUrl: z.string().url(),
});

/** 파이프라인 measure 단계가 기록하는 정량 지표 (01-constitution §3 B1·B4 증빙) */
export const AssetMetricsSchema = z.object({
  sourceFormat: z.enum(["OBJ", "PLY", "GLB"]),
  sourceSizeMB: z.number().positive(),
  publishedSizeMB: z.number().positive().max(8, "성능 예산 B1 상한(8MB) 초과 — 등록 불가"),
  reductionPct: z.number(),
  triangles: z.number().int().positive(),
  pipelineVersion: z.string(),
  processedAt: z.string(),
});

export const Asset3DSchema = z.object({
  glbPath: z.string().startsWith("/models/"),
  posterPath: z.string().optional(),
  metrics: AssetMetricsSchema,
});

export const ArtifactSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id는 소문자 슬러그"),
  title: z.string().min(1),
  titleHanja: z.string().optional(),
  era: z.string().min(1),
  /** 유물 특징(분류) — src/catalog/taxonomy.ts CATEGORY_ORDER 참조 (02-spec AC-F2-3) */
  category: z.string().min(1),
  /** 표현 매체: 3D 모델(GLB) 또는 이미지 자료. repository가 실제 에셋 유무로 검증 */
  media: z.enum(["model", "image"]).default("model"),
  /** 쓰임새 — 유물이 실제로 어떻게 쓰였는지 (시대별 대표 유물에 부여, F9 생활 장면·도슨트) */
  usage: z.string().optional(),
  material: z.string().min(1),
  dimensions: z.string().optional(),
  description: z.string().min(1),
  museum: z.string().min(1),
  collectionNo: z.string().optional(),
  attribution: AttributionSchema,
  /** 메타데이터 출처 식별 (02-spec AC-F3-3, 예: "e뮤지엄", "국립중앙박물관 누리집") */
  sources: z.array(z.string()).default([]),
  /** 도슨트 추천 질문 칩 (02-spec AC-F4-2) */
  suggestedQuestions: z.array(z.string()).default([]),
  siteId: z.string().optional(),
  featured: z.boolean().default(false),
});

export const MetricsFileSchema = z.record(z.string(), AssetMetricsSchema);

export type Attribution = z.infer<typeof AttributionSchema>;
export type AssetMetrics = z.infer<typeof AssetMetricsSchema>;
export type Asset3D = z.infer<typeof Asset3DSchema>;
export type Artifact = z.infer<typeof ArtifactSchema>;

/** 표현 매체 — 3D 모델(GLB) 또는 이미지 자료. repository가 실제 에셋 유무로 해소한다. */
export type ModelMedia = {
  kind: "model";
  glbPath: string;
  posterPath?: string;
  metrics: AssetMetrics;
};
export type ImageMedia = { kind: "image"; imagePath: string };
export type ArtifactMedia = ModelMedia | ImageMedia;

/** 발행된 에셋이 결합된 유물 — 화면에 노출 가능한 유일한 형태 (03-domain §4 불변 규칙 1·2) */
export type ArtifactWithMedia = Artifact & { asset: ArtifactMedia };

/** 카탈로그·전시관 등에서 썸네일·폴백 이미지 경로(모델은 포스터, 이미지 유물은 원본) */
export function posterOf(a: ArtifactWithMedia): string | undefined {
  return a.asset.kind === "model" ? a.asset.posterPath : a.asset.imagePath;
}
