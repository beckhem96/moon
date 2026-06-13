import puppeteer from "puppeteer";
const FAST_4G = { offline:false, downloadThroughput: 4*1024*1024/8, uploadThroughput: 3*1024*1024/8, latency: 20 };
const median = (a) => a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
const b = await puppeteer.launch({ args: ["--no-sandbox","--disable-setuid-sandbox"] });
const runs = [];
for (let i=0;i<3;i++){
  const p = await b.newPage(); await p.setCacheEnabled(false);
  const c = await p.target().createCDPSession(); await c.send("Network.enable");
  await c.send("Network.emulateNetworkConditions", FAST_4G); await c.send("Network.clearBrowserCache");
  const t0 = Date.now();
  await p.goto("http://localhost:3000/artifacts/gold-buckle-seokamri", { waitUntil:"domcontentloaded", timeout:60000 });
  await p.waitForFunction(() => document.documentElement.dataset.modelReady === "1", { timeout:60000 });
  runs.push(Date.now()-t0); await p.close();
}
console.log(`석암리 띠고리(1.6MB) | Fast 4G | 중앙값 ${(median(runs)/1000).toFixed(2)}s | 3회 ${runs.map(r=>(r/1000).toFixed(2)).join(", ")}s`);
await b.close();
