/**
 * 국립중앙박물관 상세 페이지에서 유물 메타데이터를 수집해 content/artifacts/<slug>.json 생성.
 * 1회성 수집 도구 (T-09). 입력: /tmp/kogl_check.tsv (slug\trelicId\tfileId\tkogl\t명칭)
 * 이미 존재하는 JSON은 건너뜀(수작업 보강 보호). e뮤지엄 API 병합은 T-10에서 별도 수행.
 */
import fs from "node:fs";
import path from "node:path";

const TSV = "/tmp/kogl_check.tsv";
const OUT_DIR = path.join(process.cwd(), "content", "artifacts");
const DETAIL = (rid) =>
  `https://www.museum.go.kr/MUSEUM/contents/M0505000000.do?schM=view&searchId=search&relicId=${rid}`;

// 공식 페이지 명칭이 한자뿐인 경우의 한글 표기 보정
const OVERRIDES = {
  "moon-jar": { title: "백자 달항아리", titleHanja: "白磁大缸" },
  "spouted-pottery": { title: "주구토기", titleHanja: "注口杯" },
};
const FEATURED = new Set(["pensive-bodhisattva-4358", "moon-jar", "gold-cap"]);

const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const field = (html, label) => {
  const m = html.match(new RegExp(`<strong>${label}</strong>\\s*<p>([\\s\\S]*?)</p>`));
  const v = m ? strip(m[1]) : "";
  return v || undefined;
};
const lastSeg = (s) => s?.split("-").pop()?.trim();

const rows = fs
  .readFileSync(TSV, "utf-8")
  .trim()
  .split("\n")
  .map((l) => l.split("\t"));

for (const [slug, rid, , kogl, tsvName] of rows) {
  const outPath = path.join(OUT_DIR, `${slug}.json`);
  if (fs.existsSync(outPath)) {
    console.log(`skip (이미 존재): ${slug}`);
    continue;
  }
  const html = await (
    await fetch(DETAIL(rid), { headers: { "User-Agent": "Mozilla/5.0" } })
  ).text();

  const pageTitle = field(html, "명칭");
  const hasKorean = (s) => /[가-힣]/.test(s ?? "");
  const ov = OVERRIDES[slug] ?? {};
  const title = ov.title ?? (hasKorean(pageTitle) ? pageTitle : hasKorean(tsvName) ? tsvName : pageTitle ?? tsvName);

  // 설명: 본문에서 충분히 긴 첫 문단 (라이선스·안내 문구 제외)
  const desc = [...html.matchAll(/<p>([\s\S]{60,}?)<\/p>/g)]
    .map((m) => strip(m[1]))
    .find((t) => t.length >= 60 && !/공공누리|저작물|쿠키|개인정보|Copyright/i.test(t));

  const artifact = {
    id: slug,
    title,
    ...(ov.titleHanja ? { titleHanja: ov.titleHanja } : {}),
    era: lastSeg(field(html, "국적/시대")) ?? "미상",
    material: lastSeg(field(html, "재질")) ?? "미상",
    ...(field(html, "크기") ? { dimensions: field(html, "크기") } : {}),
    description:
      desc ?? `${title}. 국립중앙박물관이 공개한 3D 디지털 소장품으로, 웹에서 실물처럼 돌려볼 수 있다.`,
    museum: "국립중앙박물관",
    ...(field(html, "소장품번호") ? { collectionNo: field(html, "소장품번호") } : {}),
    attribution: {
      kogl: Number(kogl.replace("opencode", "")),
      provider: "국립중앙박물관",
      sourceUrl: DETAIL(rid),
    },
    sources: ["국립중앙박물관 소장품 3D 상세(2026-06-12 수집)"],
    suggestedQuestions: [
      "이 유물은 무엇에 쓰던 물건인가요?",
      "어느 시대에 만들어졌고, 그 시대는 어떤 모습이었나요?",
      "이 유물에서 눈여겨볼 부분은 어디인가요?",
    ],
    featured: FEATURED.has(slug),
  };

  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + "\n");
  console.log(`wrote: ${slug} — ${title} / ${artifact.era} / ${artifact.material}${desc ? "" : " (설명 폴백)"}`);
  await new Promise((r) => setTimeout(r, 400));
}
