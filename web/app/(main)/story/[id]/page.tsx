import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { artifactRepository } from "@/src/catalog/repository";
import { posterOf } from "@/src/catalog/schema";
import StoryView, { type StoryChapter, type StoryStep } from "@/src/story/StoryView";

interface RawChapter {
  id: string;
  title: string;
  subtitle: string;
  intro: string;
  coverKey: string;
  steps: { artifactId: string; text: string }[];
}

function readChapters(): RawChapter[] {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "stories.json"), "utf-8"));
}

export function generateStaticParams() {
  return readChapters().map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = readChapters().find((x) => x.id === id);
  return c ? { title: `${c.title} — 역사 이야기`, description: c.intro.slice(0, 120) } : {};
}

export default async function StoryChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = readChapters().find((c) => c.id === id);
  if (!raw) notFound();

  const steps: StoryStep[] = raw.steps.flatMap((s) => {
    const a = artifactRepository.getById(s.artifactId);
    if (!a) return [];
    return [{
      artifactId: s.artifactId,
      text: s.text,
      kind: a.asset.kind,
      title: a.title,
      glbPath: a.asset.kind === "model" ? a.asset.glbPath : undefined,
      imagePath: posterOf(a),
    }];
  });
  const chapter: StoryChapter = { id: raw.id, title: raw.title, subtitle: raw.subtitle, intro: raw.intro, steps };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/story" className="text-sm text-neutral-500 hover:underline">← 역사 이야기</Link>
      <h1 className="mt-2 text-3xl font-bold">{raw.title}</h1>
      <p className="mt-1 text-neutral-500">{raw.subtitle}</p>
      <p className="mb-8 mt-4 max-w-2xl leading-relaxed text-neutral-700">{raw.intro}</p>
      <StoryView chapter={chapter} />
      <p className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
        유물 3D·이미지·정보의 출처는 국립중앙박물관입니다. 본문은 일반 한국사 지식에 기반한 편집 글입니다.
      </p>
    </main>
  );
}
