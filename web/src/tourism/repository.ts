import fs from "node:fs";
import path from "node:path";
import type { HeritageSite, TourismInfo } from "./acl";

const CONTENT_DIR = path.join(process.cwd(), "content");

export function getSiteById(id: string): HeritageSite | null {
  const sites = JSON.parse(
    fs.readFileSync(path.join(CONTENT_DIR, "sites.json"), "utf-8"),
  ) as HeritageSite[];
  return sites.find((s) => s.id === id) ?? null;
}

/** AC-F5-3: API 실패 시 폴백 — 사전 수집 스냅숏 (실데이터, 수집 시각 명기. 헌법 §2-3) */
export function getTourismSnapshot(
  siteId: string,
): { collectedAt: string; items: TourismInfo[] } | null {
  const p = path.join(CONTENT_DIR, "tourism-snapshot.json");
  if (!fs.existsSync(p)) return null;
  const all = JSON.parse(fs.readFileSync(p, "utf-8"));
  return all[siteId] ?? null;
}
