/**
 * AI 생성 역사 장면 이미지(스토리 표지) — HF Inference(text-to-image)로 생성 → public/scenes/<key>.jpg.
 * 토큰은 환경변수에서만 읽고 저장하지 않는다. 실행: HF_TOKEN=*** node scripts/ai/gen-scenes.mjs
 * 정직성: 생성 이미지는 UI에서 "AI 생성 재현"으로 명시(실제 유물 아님).
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const TOKEN = process.env.HF_TOKEN;
if (!TOKEN) throw new Error("HF_TOKEN 환경변수가 필요합니다.");
const MODEL = process.env.HF_MODEL || "black-forest-labs/FLUX.1-schnell";
const OUT = path.join(process.cwd(), "public", "scenes");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SUFFIX =
  ", painterly atmospheric historical reconstruction illustration, traditional Korean landscape, soft cinematic light, muted earthy palette, highly detailed, no text, no letters, no watermark";
const SCENES = [
  { key: "story-clay", prompt: "Ancient Korean Neolithic riverside village, people shaping clay pottery beside a fire at warm dawn" },
  { key: "story-silla", prompt: "Ancient Korean Silla kingdom golden age, great royal burial mounds under golden dusk light, regal mood" },
  { key: "story-tools", prompt: "Prehistoric Korean people crafting stone and bronze tools, a hunting scene at dawn in a wild valley" },
  { key: "story-buddha", prompt: "Serene ancient Korean Buddhist temple hall interior, golden statue silhouettes, candlelight and drifting incense smoke, reverent quiet atmosphere" },
  { key: "story-celadon", prompt: "Goryeo dynasty Korean celadon pottery workshop, shelves of jade-green glazed vessels, soft daylight through paper windows, refined elegant mood" },
  { key: "story-baekja", prompt: "Joseon dynasty Korean scholar's room, a single white porcelain moon jar on a wooden floor, minimal serene space, soft morning light" },
  { key: "story-inscribed", prompt: "A Joseon scholar studying ancient bronze and celadon artifacts engraved with old characters, by warm candlelight, scholarly contemplative mood" },
];

async function gen(prompt) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(`https://router.huggingface.co/hf-inference/models/${MODEL}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Accept: "image/png" },
      body: JSON.stringify({ inputs: prompt + SUFFIX, parameters: { num_inference_steps: 4 } }),
    });
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.startsWith("image/")) return Buffer.from(await res.arrayBuffer());
    const text = await res.text();
    if (res.status === 503) {
      const wait = Math.min(20, Math.ceil((JSON.parse(text).estimated_time || 12))) ;
      console.log(`  모델 로딩 중(${res.status})… ${wait}s 대기`);
      await sleep(wait * 1000);
      continue;
    }
    throw new Error(`HF ${res.status} ${ct}: ${text.slice(0, 200)}`);
  }
  throw new Error("재시도 초과");
}

const force = process.argv.includes("--force");
for (const s of SCENES) {
  const dest = path.join(OUT, `${s.key}.jpg`);
  if (!force && fs.existsSync(dest)) {
    console.log(`건너뜀(이미 있음): ${s.key}`);
    continue;
  }
  console.log(`생성: ${s.key} …`);
  const buf = await gen(s.prompt);
  const out = await sharp(buf).resize(1248, 832, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
  fs.writeFileSync(path.join(OUT, `${s.key}.jpg`), out);
  console.log(`  ✓ public/scenes/${s.key}.jpg (${Math.round(out.length / 1024)}KB)`);
}
// 프롬프트 기록(재현용, 토큰 없음)
fs.writeFileSync(
  path.join(process.cwd(), "content", "scenes.json"),
  JSON.stringify(SCENES.map((s) => ({ key: s.key, prompt: s.prompt + SUFFIX, model: MODEL, note: "AI 생성 재현 이미지" })), null, 2) + "\n",
);
console.log("완료.");
