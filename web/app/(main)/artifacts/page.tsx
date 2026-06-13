import type { Metadata } from "next";
import Link from "next/link";
import { artifactRepository } from "@/src/catalog/repository";
import CatalogBrowser from "@/src/catalog/CatalogBrowser";

export const metadata: Metadata = {
  title: "유물 카탈로그",
  description: "국립중앙박물관 공개 3D 데이터로 만나는 한국 문화유산 — 시대·재질별로 찾아보세요.",
};

export default function ArtifactsPage() {
  const items = artifactRepository.getAll().map((a) => ({
    id: a.id,
    title: a.title,
    titleHanja: a.titleHanja,
    era: a.era,
    material: a.material,
    museum: a.museum,
    posterPath: a.asset.posterPath,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← 홈
      </Link>
      <h1 className="mt-2 text-2xl font-bold">유물 카탈로그</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">
        모든 유물은 마우스·터치로 360° 돌려볼 수 있습니다.
      </p>
      <CatalogBrowser items={items} />
    </main>
  );
}
