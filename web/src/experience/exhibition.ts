import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { artifactRepository } from "@/src/catalog/repository";

/** 03-domain §4 Exhibition 애그리거트 — 등록된 유물만 배치 참조(불변 규칙 4) */

const PlacementSchema = z.object({
  artifactId: z.string(),
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotationY: z.number().default(0),
  scale: z.number().positive().default(1),
});

const ExhibitionSchema = z.object({
  id: z.string(),
  title: z.string(),
  theme: z.string(),
  placements: z.array(PlacementSchema).min(4), // AC-F6-1
});

export interface ExhibitPlacement {
  artifactId: string;
  title: string;
  glbPath: string;
  publishedSizeMB: number;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

export interface ResolvedExhibition {
  id: string;
  title: string;
  theme: string;
  placements: ExhibitPlacement[];
  totalSizeMB: number;
}

export function getExhibitions(): ResolvedExhibition[] {
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "content", "exhibitions.json"), "utf-8"),
  );
  const exhibitions = z.array(ExhibitionSchema).parse(raw);

  return exhibitions.map((ex) => {
    const placements: ExhibitPlacement[] = [];
    for (const p of ex.placements) {
      const artifact = artifactRepository.getById(p.artifactId);
      if (!artifact) {
        throw new Error(`전시 "${ex.id}"가 미등록 유물 "${p.artifactId}"를 참조 (불변 규칙 4)`);
      }
      placements.push({
        artifactId: p.artifactId,
        title: artifact.title,
        glbPath: artifact.asset.glbPath,
        publishedSizeMB: artifact.asset.metrics.publishedSizeMB,
        position: p.position,
        rotationY: p.rotationY,
        scale: p.scale,
      });
    }
    const totalSizeMB =
      Math.round(placements.reduce((s, p) => s + p.publishedSizeMB, 0) * 10) / 10;
    return { id: ex.id, title: ex.title, theme: ex.theme, placements, totalSizeMB };
  });
}

export function getExhibition(id: string): ResolvedExhibition | null {
  return getExhibitions().find((e) => e.id === id) ?? null;
}
