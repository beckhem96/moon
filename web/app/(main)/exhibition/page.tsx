import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getExhibitions } from "@/src/experience/exhibition";

const ExhibitionRoom = dynamic(() => import("@/src/experience/ExhibitionRoom"));

export const metadata: Metadata = {
  title: "가상 전시관",
  description:
    "토기부터 도자기까지 — 분류별로 나뉜 3D 전시실을 키보드로 걸어다니며 한국 문화유산을 관람하세요.",
};

export default function ExhibitionPage() {
  const exhibition = getExhibitions()[0];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← 홈
      </Link>
      <h1 className="mt-2 text-2xl font-bold">가상 전시관 — {exhibition.title}</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">
        키보드(W·A·S·D 또는 화살표)로 걸어다니며 분류별 전시실을 둘러보고, 유물에 다가가 Enter 또는
        클릭으로 자세히 살펴보세요.
      </p>
      <ExhibitionRoom exhibition={exhibition} />
    </main>
  );
}
