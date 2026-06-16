import fs from "node:fs";
import puppeteer from "puppeteer";
const axeSrc = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf-8");
const pages = [["홈","/"],["카탈로그","/artifacts"],["상세","/artifacts/moon-jar"],["이미지상세","/artifacts/nmk-img-4328"],["타임라인","/timeline"],["소개","/about"],["임베드","/embed/moon-jar"],["전시관","/exhibition"]];
const b = await puppeteer.launch({ args:["--no-sandbox","--disable-setuid-sandbox"] });
let total = 0;
for (const [label, path] of pages) {
  const p = await b.newPage();
  await p.goto(`http://localhost:3000${path}`, { waitUntil:"domcontentloaded", timeout:60000 });
  await new Promise(r=>setTimeout(r,2500));
  await p.evaluate(axeSrc);
  const res = await p.evaluate(async () => await window.axe.run(document, { runOnly: ["wcag2a","wcag2aa","wcag21a","wcag21aa"] }));
  const v = res.violations;
  total += v.length;
  console.log(`\n■ ${label} (${path}) — ${v.length?("위반 "+v.length+"종"):"✓ 위반 없음"}`);
  for (const x of v) console.log(`  [${x.impact}] ${x.id}: ${x.help} (${x.nodes.length}곳)\n     예: ${x.nodes[0].target.join(" ")}`);
  await p.close();
}
await b.close();
console.log(total===0 ? "\n=== WCAG 2.1 AA 자동 점검 위반 0종 ===" : `\n=== 총 ${total}종 ===`);
