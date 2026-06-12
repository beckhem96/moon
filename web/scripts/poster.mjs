/**
 * 발행된 유물의 포스터 이미지(public/models/<slug>.jpg) 생성 — 02-spec AC-F1-3 폴백·썸네일·OG용.
 * /embed/<slug>를 헤드리스 Chrome(SwiftShader WebGL)으로 열어 렌더 완료 신호(data-model-ready) 후 캡처.
 * 사용법: node scripts/poster.mjs [slug…]  (생략 시 metrics.json의 전체 발행 유물)
 * 전제: 서버 기동 중 (POSTER_BASE_URL, 기본 http://localhost:3000)
 */
import fs from "node:fs";
import puppeteer from "puppeteer";

const metrics = JSON.parse(fs.readFileSync("content/metrics.json", "utf-8"));
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(metrics).sort();
const base = process.env.POSTER_BASE_URL ?? "http://localhost:3000";

const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 1 });

let failed = 0;
for (const slug of slugs) {
  try {
    await page.goto(`${base}/embed/${slug}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction(() => document.documentElement.dataset.modelReady === "1", {
      timeout: 90_000,
    });
    await new Promise((r) => setTimeout(r, 900)); // 카메라 핏·첫 프레임 안정화
    const canvas = await page.$("canvas");
    await canvas.screenshot({ path: `public/models/${slug}.jpg`, type: "jpeg", quality: 86 });
    console.log(`poster ✓ ${slug}`);
  } catch (e) {
    failed++;
    console.error(`poster ✗ ${slug}: ${e.message.split("\n")[0]}`);
  }
}
await browser.close();
if (failed) process.exit(1);
