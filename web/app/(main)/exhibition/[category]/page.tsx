import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { listRooms, getRoom } from "@/src/experience/exhibition";
import { slugToCategory } from "@/src/catalog/taxonomy";

const ExhibitionRoom = dynamic(() => import("@/src/experience/ExhibitionRoom"));

export function generateStaticParams() {
  return listRooms().map((r) => ({ category: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const cat = slugToCategory(category);
  return cat ? { title: `${cat} 전시실 — 가상 전시관`, description: `${cat} 유물을 실제 크기로 전시하는 3D 전시실.` } : {};
}

export default async function ExhibitionRoomPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = slugToCategory(category);
  const room = cat ? getRoom(cat) : null;
  if (!room) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/exhibition" className="text-sm text-neutral-500 hover:underline">← 전시관 목록</Link>
      <h1 className="mt-2 text-2xl font-bold">가상 전시관 — {room.category}</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">
        유물을 <b>실제 크기</b>로 전시합니다. 키보드(W·A·S·D 또는 화살표)로 걸어다니며, 유물에 다가가 Enter 또는 클릭으로 자세히 보세요.
      </p>
      <ExhibitionRoom room={room} />
    </main>
  );
}
