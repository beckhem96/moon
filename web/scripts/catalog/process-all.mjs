/**
 * 다운로드된 신규 유물(assets/source/<slug>)을 일괄 파이프라인 처리 + content/artifacts JSON 생성.
 * - 각 slug에 scripts/pipeline/run.mjs 실행(실패 시 --texsize 1024 재시도, 그래도 실패면 건너뜀)
 * - 발행 성공(metrics.json 등재) 시에만 유물 JSON 작성 (도메인 불변 규칙 2)
 * 재실행 안전: 이미 발행+JSON 있으면 건너뜀.  실행: (web/에서) node scripts/catalog/process-all.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const WEB = process.cwd();
const MOON = path.resolve(WEB, "..");
const SRC = path.join(MOON, "assets", "source");
const ART = path.join(WEB, "content", "artifacts");
const METRICS = path.join(WEB, "content", "metrics.json");
const manifest = JSON.parse(fs.readFileSync(path.join(MOON, "assets", "catalog-manifest.json"), "utf-8"));

const todo = manifest.filter((m) => {
  const dir = path.join(SRC, m.slug);
  return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith(".zip"));
});
console.log(`처리 대상 ${todo.length}점`);

const readMetrics = () => JSON.parse(fs.readFileSync(METRICS, "utf-8"));
const runPipeline = (slug, extra = []) =>
  spawnSync("node", ["scripts/pipeline/run.mjs", slug, ...extra], { cwd: WEB, encoding: "utf-8" });

function writeArtifact(m) {
  const out = {
    id: m.slug,
    title: m.name || m.slug,
    era: m.era,
    category: m.category,
    material: m.material,
    ...(m.dimensions ? { dimensions: m.dimensions } : {}),
    description: `${m.name || "이 유물"}. 국립중앙박물관이 공개한 3D 디지털 소장품으로, 웹에서 실물처럼 360° 돌려볼 수 있다.`,
    museum: "국립중앙박물관",
    ...(m.collectionNo ? { collectionNo: m.collectionNo } : {}),
    attribution: {
      kogl: m.koglType ?? 1,
      provider: "국립중앙박물관",
      sourceUrl: m.sourceUrl,
    },
    sources: ["국립중앙박물관 소장품 3D 상세(2026-06-16 일괄 수집)"],
    suggestedQuestions: [
      "이 유물은 무엇에 쓰던 물건인가요?",
      "어느 시대에 만들어졌고, 그 시대는 어떤 모습이었나요?",
      "이 유물에서 눈여겨볼 부분은 어디인가요?",
    ],
    featured: false,
  };
  fs.writeFileSync(path.join(ART, `${m.slug}.json`), JSON.stringify(out, null, 2) + "\n");
}

let published = 0, failed = 0, already = 0;
let i = 0;
for (const m of todo) {
  i++;
  const jsonPath = path.join(ART, `${m.slug}.json`);
  if (readMetrics()[m.slug] && fs.existsSync(jsonPath)) {
    already++;
    continue;
  }
  // 1차 시도(기본 2048) → 실패 시 1024로 재시도(예산/메모리)
  let r = runPipeline(m.slug);
  if (r.status !== 0) r = runPipeline(m.slug, ["--texsize", "1024"]);

  if (r.status === 0 && readMetrics()[m.slug]) {
    writeArtifact(m);
    published++;
    const pub = readMetrics()[m.slug].publishedSizeMB;
    console.log(`[${i}/${todo.length}] ✓ ${m.slug} ${m.name} — ${pub}MB (${m.category})`);
  } else {
    failed++;
    const tail = (r.stderr || r.stdout || "").trim().split("\n").pop();
    console.log(`[${i}/${todo.length}] ✗ ${m.slug} ${m.name} — 건너뜀: ${tail}`);
  }
}

console.log(`\n완료: 신규발행 ${published} · 기존 ${already} · 실패/건너뜀 ${failed}`);
console.log(`현재 발행 총계(metrics): ${Object.keys(readMetrics()).length}점`);
