import puppeteer from "puppeteer";
const pages = [
  ["홈", "/"], ["카탈로그", "/artifacts"], ["상세", "/artifacts/moon-jar"],
  ["전시관", "/exhibition"], ["소개", "/about"], ["임베드", "/embed/moon-jar"],
  ["404", "/artifacts/does-not-exist"],
];
const b = await puppeteer.launch({ args: ["--no-sandbox","--disable-setuid-sandbox"] });
let total = 0;
for (const [label, path] of pages) {
  const p = await b.newPage();
  const msgs = [];
  p.on("console", m => { if (m.type()==="error") msgs.push(m.text()); });
  p.on("pageerror", e => msgs.push("PAGEERROR: "+e.message));
  const resp = await p.goto(`http://localhost:3000${path}`, { waitUntil:"domcontentloaded", timeout:60000 }).catch(e=>({status:()=>"ERR:"+e.message}));
  // 전시관은 입장 버튼 클릭
  if (path==="/exhibition") { await new Promise(r=>setTimeout(r,1500)); await p.evaluate(()=>{const x=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('입장')); x&&x.click();}); }
  await new Promise(r=>setTimeout(r,3000));
  // 외부 이미지(visitkorea http) mixed-content/404는 서비스 책임 아님 → 필터
  const real = msgs.filter(m => !/visitkorea|tong\.|favicon|the server responded with a status of 404/i.test(m));
  total += real.length;
  console.log(`${resp.status?.()??"?"} ${label.padEnd(6)} ${path.padEnd(28)} ${real.length?("⚠ "+real.length+"건: "+real.slice(0,2).join(" | ")):"✓ 깨끗"}`);
  await p.close();
}
await b.close();
console.log(total===0 ? "\n=== 전 페이지 콘솔 오류 없음 ===" : `\n=== 총 ${total}건 (검토 필요) ===`);
