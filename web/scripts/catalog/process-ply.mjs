/** OBJ 처리에서 누락된(스캔_PLY만 있는) 유물을 PLY 파이프라인으로 발행 + JSON 생성. */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const WEB = process.cwd();
const MOON = path.resolve(WEB, "..");
const SRC = path.join(MOON, "assets", "source");
const ART = path.join(WEB, "content", "artifacts");
const METRICS = path.join(WEB, "content", "metrics.json");
const manifest = JSON.parse(fs.readFileSync(path.join(MOON, "assets", "catalog-manifest.json"), "utf-8"));
const readMetrics = () => JSON.parse(fs.readFileSync(METRICS, "utf-8"));

const pending = manifest.filter((m) => {
  const dir = path.join(SRC, m.slug);
  const hasZip = fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith(".zip"));
  const jsonExists = fs.existsSync(path.join(ART, `${m.slug}.json`));
  return hasZip && !(readMetrics()[m.slug] && jsonExists); // 미발행 또는 JSON 누락
});
console.log(`PLY 처리 대상 ${pending.length}점`);

function writeArtifact(m) {
  const out = {
    id: m.slug,
    title: m.name || m.slug,
    era: m.era,
    category: m.category,
    material: m.material,
    ...(m.dimensions ? { dimensions: m.dimensions } : {}),
    description: `${m.name || "이 유물"}. 국립중앙박물관이 공개한 3D 스캔 디지털 소장품으로, 웹에서 실물 형태를 360° 돌려볼 수 있다.`,
    museum: "국립중앙박물관",
    ...(m.collectionNo ? { collectionNo: m.collectionNo } : {}),
    attribution: { kogl: m.koglType ?? 1, provider: "국립중앙박물관", sourceUrl: m.sourceUrl },
    sources: ["국립중앙박물관 소장품 3D(스캔 PLY) 상세(2026-06-16 일괄 수집)"],
    suggestedQuestions: [
      "이 유물은 무엇에 쓰던 물건인가요?",
      "어느 시대에 만들어졌고, 그 시대는 어떤 모습이었나요?",
      "이 유물에서 눈여겨볼 부분은 어디인가요?",
    ],
    featured: false,
  };
  fs.writeFileSync(path.join(ART, `${m.slug}.json`), JSON.stringify(out, null, 2) + "\n");
}

let ok = 0, fail = 0, i = 0;
for (const m of pending) {
  i++;
  // 이미 발행됐는데 JSON만 없으면 파이프라인 건너뛰고 JSON만 작성
  if (readMetrics()[m.slug]) {
    writeArtifact(m);
    ok++;
    console.log(`[${i}/${pending.length}] ✓ ${m.slug} ${m.name} — JSON만 작성 (${readMetrics()[m.slug].publishedSizeMB}MB)`);
    continue;
  }
  const r = spawnSync("node", ["scripts/pipeline/run-ply.mjs", m.slug], { cwd: WEB, encoding: "utf-8" });
  if (r.status === 0 && readMetrics()[m.slug]) {
    writeArtifact(m);
    ok++;
    console.log(`[${i}/${pending.length}] ✓ ${m.slug} ${m.name} — ${readMetrics()[m.slug].publishedSizeMB}MB (${m.category})`);
  } else {
    fail++;
    const tail = (r.stderr || r.stdout || "").trim().split("\n").filter(Boolean).pop();
    console.log(`[${i}/${pending.length}] ✗ ${m.slug} ${m.name} — ${tail}`);
  }
}
console.log(`\nPLY 완료: 발행 ${ok} · 실패 ${fail} · 현재 총계 ${Object.keys(readMetrics()).length}점`);
