/**
 * 초기 시대(구석기·신석기·청동기·철기) 이미지 유물을 국립중앙박물관 소장품 검색에서 수집.
 * 3D가 없는 이미지 전용 유물(media:"image")로 카탈로그·타임라인을 보강한다.
 * 선별 기준: 국적 한국 + 공공누리 제1유형 + 대표이미지 존재 + 목표 시대 일치. 시대당 ~TARGET점.
 * 실행: (web/에서) node scripts/catalog/collect-images.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const WEB = process.cwd();
const MOON = path.resolve(WEB, "..");
const ART = path.join(WEB, "content", "artifacts");
const IMG = path.join(WEB, "public", "images");
const HOST = "https://www.museum.go.kr";
const UA = { headers: { "User-Agent": "Mozilla/5.0" } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const lastSeg = (s) => s?.split("-").pop()?.trim();
fs.mkdirSync(IMG, { recursive: true });

const TARGET_PER_ERA = 20;
const ERAS = [
  { era: "구석기", keywords: ["주먹도끼", "찍개", "긁개", "슴베찌르개", "주먹찌르개", "몸돌", "격지", "찌르개"] },
  { era: "신석기", keywords: ["빗살무늬토기", "갈돌", "갈판", "돌괭이", "덧무늬토기", "치레걸이", "이른민무늬토기", "그물추"] },
  { era: "청동기", keywords: ["비파형동검", "민무늬토기", "반달돌칼", "간돌검", "붉은간토기", "청동방울", "돌화살촉", "바퀴날도끼", "거푸집"] },
  { era: "철기", keywords: ["세형동검", "청동거울", "잔무늬거울", "덧띠토기", "오리모양토기", "쇠도끼", "청동투겁창", "고리자루칼", "쇠뿔모양손잡이"] },
];

// 이미 보유한 relicId(3D)는 건너뜀
const owned = new Set();
for (const d of fs.existsSync(path.join(MOON, "assets", "source")) ? fs.readdirSync(path.join(MOON, "assets", "source")) : []) {
  const md = path.join(MOON, "assets", "source", d, "SOURCE.md");
  if (fs.existsSync(md)) { const m = fs.readFileSync(md, "utf-8").match(/relicId=(\d+)/); if (m) owned.add(m[1]); }
}

function categorize(name, material) {
  const n = name || "", mat = material || "";
  if (/(청자|백자|분청|자기)/.test(n) || /자기/.test(mat)) return "도자기";
  if (/(불상|보살|반가|사유|여래|관음|나한|비로자나|천왕|불두|사리|부도|범종)/.test(n)) return "불교조각";
  if (/(동검|동모|동과|동탁|방울|거울|동경|청동|투겁|꺾창|동제|동령)/.test(n) && /동|청동|금속/.test(mat)) return "청동기";
  if (/(주먹도끼|찍개|긁개|슴베|몸돌|격지|돌도끼|돌검|돌칼|반달|화살촉|갈돌|갈판|괭이|간석기|뗀석기|숫돌|가락바퀴|돌끌|대팻날|그물추|돌)/.test(n) || /석|돌/.test(mat)) return "석기";
  if (/(토기|항아리|병|호|단지|시루|동이|토우|명기|굽다리|바리|보시기|장군|독)/.test(n) || /토제|연질|도질|흙/.test(mat)) return "토기·도기";
  if (/(금관|관식|귀[걸거]이|목걸이|팔찌|반지|허리띠|과대|드리개|장식|금제|은제|대금구|교구|띠고리|영락)/.test(n)) return "금속공예·장신구";
  if (/금|은|동/.test(mat)) return "금속공예·장신구";
  return "기타";
}

const field = (html, label) => {
  const m = html.match(new RegExp(`<strong>${label}</strong>\\s*<p>([\\s\\S]*?)</p>`));
  return m ? strip(m[1]) : "";
};
function primaryName(html) {
  const hs = [...html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/g)]
    .map((m) => strip(m[1]))
    .filter((t) => t && t.length <= 40 && !/검색|유의사항|상세보기|소장품/.test(t));
  return hs[hs.length - 1] || "";
}

async function searchIds(keyword) {
  const ids = [];
  for (let cp = 1; cp <= 3; cp++) {
    const url = `${HOST}/MUSEUM/contents/M0502000000.do?schM=collectionList&searchId=search&pageSize=12&cp=${cp}&query=${encodeURIComponent(keyword)}`;
    const h = await (await fetch(url, UA)).text();
    const found = [...new Set([...h.matchAll(/relicId=(\d+)/g)].map((m) => m[1]))];
    const fresh = found.filter((id) => !ids.includes(id));
    if (fresh.length === 0) break;
    ids.push(...fresh);
    await sleep(250);
  }
  return ids;
}

async function fetchDetail(rid) {
  const url = `${HOST}/MUSEUM/contents/M0502000000.do?schM=view&searchId=search&relicId=${rid}`;
  const html = await (await fetch(url, UA)).text();
  const nat = field(html, "국적/시대");
  const koglM = html.match(/공공누리\s*제?\s*([1-4])\s*유형/);
  const img = [...html.matchAll(/(\/relic_image\/[^\s"'?]+\.(?:jpg|jpeg|png))/gi)].map((m) => m[1])[0];
  return {
    url,
    name: primaryName(html),
    nation: nat.split("-")[0]?.trim(),
    era: lastSeg(nat) || "미상",
    material: lastSeg(field(html, "재질")) || "미상",
    dimensions: field(html, "크기") || undefined,
    collectionNo: field(html, "소장품번호") || undefined,
    kogl: koglM ? Number(koglM[1]) : null,
    img: img ? HOST + img : null,
  };
}

const seen = new Set();
let total = 0;
const summary = {};
for (const { era, keywords } of ERAS) {
  let kept = 0;
  for (const kw of keywords) {
    if (kept >= TARGET_PER_ERA) break;
    let ids;
    try { ids = await searchIds(kw); } catch { continue; }
    for (const rid of ids) {
      if (kept >= TARGET_PER_ERA) break;
      if (seen.has(rid) || owned.has(rid)) continue;
      seen.add(rid);
      const jsonPath = path.join(ART, `nmk-img-${rid}.json`);
      if (fs.existsSync(jsonPath)) { kept++; continue; }
      let d;
      try { d = await fetchDetail(rid); } catch { continue; }
      await sleep(250);
      // 선별: 한국 + KOGL1 + 이미지 + 목표 시대 일치
      const eraOk = d.era === era || (era === "철기" && /철기|원삼국/.test(d.era));
      if (d.nation !== "한국" || d.kogl !== 1 || !d.img || !eraOk || !d.name) continue;
      const eraNorm = d.era === "삼국" ? "삼국시대" : d.era;
      // 이미지 다운로드 + 리사이즈
      try {
        const buf = Buffer.from(await (await fetch(d.img, UA)).arrayBuffer());
        const out = await sharp(buf).resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
        if (out.length < 2000) continue;
        fs.writeFileSync(path.join(IMG, `nmk-img-${rid}.jpg`), out);
      } catch { continue; }
      const artifact = {
        id: `nmk-img-${rid}`,
        title: d.name,
        era: eraNorm,
        category: categorize(d.name, d.material),
        material: d.material,
        media: "image",
        ...(d.dimensions ? { dimensions: d.dimensions } : {}),
        description: `${d.name}. 국립중앙박물관 소장품으로, 대표 이미지로 만나는 ${eraNorm} 유물이다.`,
        museum: "국립중앙박물관",
        ...(d.collectionNo ? { collectionNo: d.collectionNo } : {}),
        attribution: { kogl: 1, provider: "국립중앙박물관", sourceUrl: d.url },
        sources: ["국립중앙박물관 소장품 검색(이미지·메타, 2026-06-16 수집)"],
        suggestedQuestions: [
          "이 유물은 무엇에 쓰던 물건인가요?",
          "어느 시대에 만들어졌고, 그 시대는 어떤 모습이었나요?",
          "이 유물에서 눈여겨볼 부분은 어디인가요?",
        ],
        featured: false,
      };
      fs.writeFileSync(jsonPath, JSON.stringify(artifact, null, 2) + "\n");
      kept++; total++;
      console.log(`[${era}] ${kept}/${TARGET_PER_ERA} ✓ ${d.name} · ${eraNorm}/${d.material} · ${artifact.category}`);
    }
  }
  summary[era] = kept;
}
console.log(`\n완료: 신규 이미지 유물 ${total}점 ·`, JSON.stringify(summary));
