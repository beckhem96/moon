/**
 * 국립중앙박물관 3D 소장품(총 134점) 전수 목록화 → assets/catalog-manifest.json
 * 각 항목: relicId, slug, name, era, material, dimensions, collectionNo, koglType, fileId, category
 * 이미 보유한 14점(assets/source/<slug>/SOURCE.md의 relicId)은 자동 제외.
 * 실행: (web/에서) node scripts/catalog/enumerate.mjs
 */
import fs from "node:fs";
import path from "node:path";

const WEB = process.cwd();
const MOON = path.resolve(WEB, "..");
const SRC_DIR = path.join(MOON, "assets", "source");
const OUT = path.join(MOON, "assets", "catalog-manifest.json");
const UA = { headers: { "User-Agent": "Mozilla/5.0" } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const lastSeg = (s) => s?.split("-").pop()?.trim();
const hasKo = (s) => /[가-힣]/.test(s ?? "");

// 보유 중인 relicId 수집(중복 제외)
const owned = new Set();
for (const d of fs.existsSync(SRC_DIR) ? fs.readdirSync(SRC_DIR) : []) {
  const md = path.join(SRC_DIR, d, "SOURCE.md");
  if (fs.existsSync(md)) {
    const m = fs.readFileSync(md, "utf-8").match(/relicId=(\d+)/);
    if (m) owned.add(m[1]);
  }
}
console.log(`보유 relicId ${owned.size}점 제외`);

// 1) 목록 페이지에서 relicId 전수 수집
const relicIds = [];
for (let cp = 1; cp <= 15; cp++) {
  const url = `https://www.museum.go.kr/MUSEUM/contents/M0505000000.do?schM=list&pageSize=12&cp=${cp}`;
  const html = await (await fetch(url, UA)).text();
  // 상세 링크의 relicId만(메뉴/관련항목 잡음 제외): "상세보기" 앵커 href
  const ids = [...new Set([...html.matchAll(/\?schM=view&searchId=search&relicId=(\d+)/g)].map((m) => m[1]))];
  const fresh = ids.filter((id) => !relicIds.includes(id));
  if (fresh.length === 0) break;
  relicIds.push(...fresh);
  await sleep(300);
  if (relicIds.length >= 134) break;
}
console.log(`목록 relicId 총 ${relicIds.length}점`);

// 분류(category) 자동 판정 — 불교 > 도자 > 금속/장신구 > 청동기 > 토기 > 기타
function categorize(name, material) {
  const n = name || "";
  const mat = material || "";
  // 청자/백자/분청은 명칭이 명확하므로 가장 먼저 판정(향로·주전자 등 형태어보다 우선)
  if (/(청자|백자|분청|자기)/.test(n) || /^자기$|도자/.test(mat)) return "도자기";
  if (/(불상|보살|반가|사유|여래|관음|나한|비로자나|천왕|불입상|불좌상|미륵|불두|사리|부도|범종|금강령|광배)/.test(n))
    return "불교조각";
  if (/(금관|관식|귀[걸거]이|목걸이|팔찌|반지|허리띠|과대|드리개|장식|금제|은제|대금구|교구|버클|띠고리|영락)/.test(n))
    return "금속공예·장신구";
  if (/(동검|동모|동과|동탁|방울|동경|거울|청동|투겁|꺾창|동제|동물형)/.test(n) && /동|청동/.test(mat))
    return "청동기";
  if (/(토기|항아리|병|호|완|발|그릇|장군|시루|동이|단지|옹|배|잔|토우|명기|굽다리)/.test(n) || /토제|연질|도질|흙/.test(mat))
    return "토기·도기";
  if (/금|은|동/.test(mat)) return "금속공예·장신구"; // 금속 재질 폴백
  return "기타";
}

const field = (html, label) => {
  const m = html.match(new RegExp(`<strong>${label}</strong>\\s*<p>([\\s\\S]*?)</p>`));
  return m ? strip(m[1]) : "";
};
function primaryName(html) {
  const hs = [...html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/g)]
    .map((m) => strip(m[1]))
    .filter((t) => t && t.length <= 40 && !/3D 데이터 검색|유의사항|소장품 상세보기/.test(t));
  return hs[hs.length - 1] || "";
}

const items = [];
let i = 0;
for (const rid of relicIds) {
  i++;
  if (owned.has(rid)) {
    continue;
  }
  const url = `https://www.museum.go.kr/MUSEUM/contents/M0505000000.do?schM=view&searchId=search&relicId=${rid}`;
  const html = await (await fetch(url, UA)).text();
  const fileId = (html.match(/fileDownloadById\/(\d+)/) || [])[1] || null;
  const koglM = html.match(/공공누리\s*제?\s*([1-4])\s*유형/);
  const name = primaryName(html);
  const era0 = lastSeg(field(html, "국적/시대")) || "미상";
  const era = era0 === "삼국" ? "삼국시대" : era0;
  const material = lastSeg(field(html, "재질")) || "미상";
  const dims = field(html, "크기") || undefined;
  const collectionNo = field(html, "소장품번호") || undefined;
  const item = {
    relicId: rid,
    slug: `nmk-${rid}`,
    name,
    nameKo: hasKo(name),
    era,
    material,
    category: categorize(name, material),
    dimensions: dims,
    collectionNo,
    koglType: koglM ? Number(koglM[1]) : null,
    fileId,
    sourceUrl: url,
  };
  items.push(item);
  console.log(`[${i}/${relicIds.length}] ${rid} ${name || "(이름?)"} · ${era}/${material} · ${item.category} · KOGL${item.koglType ?? "?"} · file${fileId ?? "?"}`);
  await sleep(350);
}

fs.writeFileSync(OUT, JSON.stringify(items, null, 2) + "\n");

// 요약
const by = (key) => items.reduce((a, x) => ((a[x[key] ?? "?"] = (a[x[key] ?? "?"] || 0) + 1), a), {});
console.log(`\n신규 ${items.length}점 → ${OUT}`);
console.log("분류:", JSON.stringify(by("category"), null, 0));
console.log("KOGL:", JSON.stringify(by("koglType"), null, 0));
console.log("시대:", JSON.stringify(by("era"), null, 0));
console.log("이름 한글 없음:", items.filter((x) => !x.nameKo).length, "· fileId 없음:", items.filter((x) => !x.fileId).length);
