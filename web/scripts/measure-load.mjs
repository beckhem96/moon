import puppeteer from "puppeteer";

// Fast 4G 프리셋 (Chrome DevTools 근사): 4Mbps down / 3Mbps up / 20ms RTT
const FAST_4G = { offline:false, downloadThroughput: 4*1024*1024/8, uploadThroughput: 3*1024*1024/8, latency: 20 };
const targets = [
  { slug: "pensive-bodhisattva-4358", label: "금동 반가사유상(1.27MB)" },
  { slug: "gold-buckle-seokamri",     label: "평양 석암리 금제 띠고리(2.74MB·최대)" },
];

async function measure(page, slug, throttle) {
  const client = await page.target().createCDPSession();
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", throttle ?? { offline:false, downloadThroughput:-1, uploadThroughput:-1, latency:0 });
  await client.send("Network.clearBrowserCache");
  const t0 = Date.now();
  await page.goto(`http://localhost:3000/artifacts/${slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.dataset.modelReady === "1", { timeout: 60000 });
  return Date.now() - t0;
}
const median = (a) => a.sort((x,y)=>x-y)[Math.floor(a.length/2)];

const b = await puppeteer.launch({ args: ["--no-sandbox","--disable-setuid-sandbox"] });
for (const { slug, label } of targets) {
  for (const [name, cond] of [["광대역", null], ["Fast 4G", FAST_4G]]) {
    const runs = [];
    for (let i=0;i<3;i++){ const p = await b.newPage(); await p.setCacheEnabled(false); runs.push(await measure(p, slug, cond)); await p.close(); }
    console.log(`${label} | ${name} | 중앙값 ${(median(runs)/1000).toFixed(2)}s | 3회 ${runs.map(r=>(r/1000).toFixed(2)).join(", ")}s`);
  }
}
await b.close();
