import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { artifactRepository } from "@/src/catalog/repository";
import { posterOf } from "@/src/catalog/schema";
import TimelineView, { type TimelineEra } from "@/src/timeline/TimelineView";

export const metadata: Metadata = {
  title: "시대 타임라인",
  description:
    "구석기부터 조선까지 — 시대별 배경과 함께 한국 문화유산을 인터랙티브하게 둘러보세요.",
};

interface EraMeta {
  id: string;
  range: string;
  summary: string;
  life: string;
}

export default function TimelinePage() {
  const eras: EraMeta[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "content", "eras.json"), "utf-8"),
  );
  const artifacts = artifactRepository.getAll();

  const data: TimelineEra[] = eras
    .map((e) => ({
      ...e,
      artifacts: artifacts
        .filter((a) => a.era === e.id)
        .map((a) => ({
          id: a.id,
          title: a.title,
          category: a.category,
          mediaKind: a.asset.kind,
          posterPath: posterOf(a),
        })),
    }))
    .filter((e) => e.artifacts.length > 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← 홈
      </Link>
      <h1 className="mt-2 text-2xl font-bold">시대 타임라인</h1>
      <p className="mb-2 mt-1 text-sm text-neutral-500">
        시대를 펼쳐 그 시대의 배경과 유물을 만나보세요. 유물을 클릭하면 자세히 볼 수 있습니다.
      </p>
      <p className="mb-6 text-xs text-neutral-500">
        ※ 시대 개요는 이해를 돕기 위한 편집 요약이며, 유물 정보·이미지의 출처는 국립중앙박물관입니다.
      </p>
      <TimelineView eras={data} />
    </main>
  );
}
