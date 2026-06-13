/**
 * TourAPI 스냅숏 수집 → content/tourism-snapshot.json (AC-F5-3 폴백용 실데이터).
 * .env.local의 TOUR_API_KEY 사용. 연고지 목록은 content/sites.json.
 */
import fs from "node:fs";
import path from "node:path";

// .env.local 간이 로드 (런타임 Next.js와 달리 스크립트는 직접 읽는다)
const envPath = path.resolve(process.cwd(), "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { fetchNearbyTourism } = await import("../src/tourism/acl.ts");

const sites = JSON.parse(fs.readFileSync("content/sites.json", "utf-8"));
const out = {};
for (const site of sites) {
  const items = await fetchNearbyTourism(site, { rows: 6, radiusM: 3000 });
  out[site.id] = { collectedAt: new Date().toISOString().slice(0, 16) + "Z", items };
  console.log(`snapshot ✓ ${site.id} — ${items.length}건`);
}
fs.writeFileSync("content/tourism-snapshot.json", JSON.stringify(out, null, 2) + "\n");
