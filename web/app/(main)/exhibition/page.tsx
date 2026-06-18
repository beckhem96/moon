import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { listRooms } from "@/src/experience/exhibition";

export const metadata: Metadata = {
  title: "가상 전시관",
  description: "분류별 전시실에 따로 입장해 — 유물을 실제 크기로 — 키보드로 거닐며 관람하세요.",
};

export default function ExhibitionLobbyPage() {
  const rooms = listRooms();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← 홈</Link>
      <h1 className="mt-2 text-2xl font-bold">가상 전시관</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">
        분류별 전시실을 골라 입장하세요. 각 전시실의 유물은 <b>실제 크기</b>로 전시되며, 키보드(W·A·S·D)로 걸어다니며 관람합니다.
      </p>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <li key={r.slug}>
            <Link href={`/exhibition/${r.slug}`} className="group block overflow-hidden rounded-2xl border border-neutral-200 transition hover:border-neutral-400 hover:shadow-md">
              <div className="relative aspect-[4/3] bg-neutral-900">
                {r.posterPath && (
                  <Image src={r.posterPath} alt={`${r.category} 전시실`} fill sizes="(max-width:640px) 100vw, 33vw" className="object-cover transition group-hover:scale-105" />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-lg font-bold text-white">
                  {r.category}
                </span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-neutral-600">대표 {r.shown}점{r.count > r.shown ? ` / 전체 ${r.count}점` : ""}</span>
                <span className="text-sm font-medium text-sky-700">입장 →</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
