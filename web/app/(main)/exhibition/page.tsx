import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getExhibitions } from "@/src/experience/exhibition";

const ExhibitionRoom = dynamic(() => import("@/src/experience/ExhibitionRoom"));

export const metadata: Metadata = {
  title: "가상 전시관",
  description: "신석기부터 조선까지, 한국 문화유산을 3D 공간에서 거닐며 둘러보세요.",
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
        유물을 클릭하면 자세히 살펴볼 수 있습니다. 드래그로 둘러보고 휠로 가까이 다가가세요.
      </p>
      <ExhibitionRoom exhibition={exhibition} />
    </main>
  );
}
