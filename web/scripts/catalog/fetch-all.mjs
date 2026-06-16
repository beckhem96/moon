/**
 * catalog-manifest.json의 신규 유물 원본 zip을 국립중앙박물관에서 내려받아
 * assets/source/<slug>/<원본이름>.zip + SOURCE.md 생성. 이미 zip이 있으면 건너뜀(재실행 안전).
 * 실행: (web/에서) node scripts/catalog/fetch-all.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const WEB = process.cwd();
const MOON = path.resolve(WEB, "..");
const SRC = path.join(MOON, "assets", "source");
const manifest = JSON.parse(fs.readFileSync(path.join(MOON, "assets", "catalog-manifest.json"), "utf-8"));
const UA = { headers: { "User-Agent": "Mozilla/5.0" } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (b) => Math.round((b / 1048576) * 10) / 10;

const todo = manifest.filter((m) => m.fileId);
console.log(`다운로드 대상 ${todo.length}점 (fileId 없는 ${manifest.length - todo.length}점 제외)`);

let done = 0, skipped = 0, failed = 0, bytes = 0;
for (const m of todo) {
  const dir = path.join(SRC, m.slug);
  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.readdirSync(dir).find((f) => f.endsWith(".zip"));
  if (existing) {
    skipped++;
    continue;
  }
  const url = `https://www.museum.go.kr/afile/fileDownloadById/${m.fileId}`;
  let ok = false;
  for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
    try {
      const res = await fetch(url, UA);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cd = res.headers.get("content-disposition") || "";
      const fn = (cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i) || [])[1];
      const name = fn && fn.endsWith(".zip") ? decodeURIComponent(fn) : `${m.slug}.zip`;
      const dest = path.join(dir, name);
      await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest));
      const sz = fs.statSync(dest).size;
      if (sz < 1024) throw new Error(`too small ${sz}B`);
      bytes += sz;
      // SOURCE.md
      fs.writeFileSync(
        path.join(dir, "SOURCE.md"),
        `# 출처 메모 — ${m.name}\n\n` +
          `- **슬러그**: \`${m.slug}\`\n` +
          `- **유물명**: ${m.name}\n` +
          `- **국적/시대**: ${m.era} · **재질**: ${m.material}\n` +
          `- **제공처**: 국립중앙박물관 (museum.go.kr)\n` +
          `- **상세 페이지**: ${m.sourceUrl}\n` +
          `- **다운로드**: ${url} (\`${name}\`, ${mb(sz)}M)\n` +
          `- **라이선스**: 공공누리 제${m.koglType ?? "?"}유형(출처표시) — 상세 페이지 확인\n` +
          `- **수집일**: ${new Date().toISOString().slice(0, 10)} (일괄 수집)\n`,
      );
      ok = true;
      done++;
      console.log(`[${done + skipped}/${todo.length}] ✓ ${m.slug} ${name} ${mb(sz)}M (${m.category})`);
    } catch (e) {
      if (attempt === 2) {
        failed++;
        console.log(`[!] 실패 ${m.slug} file${m.fileId}: ${e.message}`);
      } else {
        await sleep(1500);
      }
    }
  }
  await sleep(500); // 정부 서버 배려
}

console.log(`\n완료: 신규 ${done} · 기존건너뜀 ${skipped} · 실패 ${failed} · 다운로드 ${mb(bytes)}MB`);
