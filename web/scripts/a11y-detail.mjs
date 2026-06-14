import fs from "node:fs";
import puppeteer from "puppeteer";
const axeSrc = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf-8");
const b = await puppeteer.launch({ args:["--no-sandbox","--disable-setuid-sandbox"] });
const p = await b.newPage();
await p.goto("http://localhost:3000/artifacts/moon-jar", { waitUntil:"domcontentloaded", timeout:60000 });
await new Promise(r=>setTimeout(r,2500));
await p.evaluate(axeSrc);
const res = await p.evaluate(async () => await window.axe.run(document, { runOnly:["wcag2aa"] }));
const cc = res.violations.find(v=>v.id==="color-contrast");
const seen = new Set();
for (const n of cc.nodes) {
  const m = n.any[0]?.data;
  const key = `${m?.fgColor} on ${m?.bgColor} (${m?.contrastRatio}:1, need ${m?.expectedContrastRatio})`;
  if (!seen.has(key)) { seen.add(key); console.log(key, "→", n.html.slice(0,70)); }
}
await b.close();
