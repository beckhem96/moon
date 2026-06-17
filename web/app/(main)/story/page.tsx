import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { artifactRepository } from "@/src/catalog/repository";
import { posterOf } from "@/src/catalog/schema";

export const metadata: Metadata = {
  title: "역사 이야기",
  description: "스크롤하며 만나는 한국 문화유산 이야기 — 3D와 이미지로 흐름을 따라가세요.",
};

interface RawChapter {
  id: string;
  title: string;
  subtitle: string;
  intro: string;
  coverKey: string;
  steps: { artifactId: string }[];
}

export default function StoryListPage() {
  const chapters: RawChapter[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "content", "stories.json"), "utf-8"),
  );
  const cards = chapters.map((c) => {
    const sceneRel = `scenes/${c.coverKey}.jpg`;
    const hasScene = fs.existsSync(path.join(process.cwd(), "public", sceneRel));
    const first = artifactRepository.getById(c.steps[0]?.artifactId);
    return {
      ...c,
      cover: hasScene ? `/${sceneRel}` : (first ? posterOf(first) : undefined),
      coverIsScene: hasScene,
    };
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← 홈</Link>
      <h1 className="mt-2 text-2xl font-bold">역사 이야기</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">
        스크롤에 따라 3D 유물과 이미지가 흐르며 한국사의 한 장면을 들려줍니다.
      </p>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.id}>
            <Link href={`/story/${c.id}`} className="group block overflow-hidden rounded-2xl border border-neutral-200 transition hover:border-neutral-400 hover:shadow-md">
              <div className="relative aspect-[4/3] bg-neutral-900">
                {c.cover && (
                  <Image src={c.cover} alt={c.title} fill sizes="(max-width:640px) 100vw, 33vw" className="object-cover transition group-hover:scale-105" />
                )}
                {c.coverIsScene && (
                  <span className="absolute right-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">AI 생성 재현</span>
                )}
              </div>
              <div className="p-4">
                <p className="font-semibold">{c.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{c.subtitle}</p>
                <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{c.intro}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
