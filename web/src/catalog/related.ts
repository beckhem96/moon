import fs from "node:fs";
import path from "node:path";
import { artifactRepository } from "./repository";
import { posterOf } from "./schema";

/** 사전계산된 의미 임베딩 이웃(content/similar.json)으로 '비슷한 유물'을 해소한다. */
export interface RelatedItem {
  id: string;
  title: string;
  era: string;
  category: string;
  mediaKind: "model" | "image";
  posterPath?: string;
}

let cache: Record<string, string[]> | null = null;

export function getRelated(id: string, limit = 6): RelatedItem[] {
  cache ??= JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "content", "similar.json"), "utf-8"),
  );
  const ids = cache?.[id] ?? [];
  const out: RelatedItem[] = [];
  for (const rid of ids) {
    const a = artifactRepository.getById(rid);
    if (!a) continue;
    out.push({
      id: a.id,
      title: a.title,
      era: a.era,
      category: a.category,
      mediaKind: a.asset.kind,
      posterPath: posterOf(a),
    });
    if (out.length >= limit) break;
  }
  return out;
}
