/**
 * 유물 의미 임베딩 사전계산 (transformers.js, Xenova/multilingual-e5-small, 서버/키 불필요).
 * 출력: content/embeddings.json (id→384차원 정규화 벡터) + content/similar.json (id→유사 top-8 id).
 * 의미 검색(/search)·비슷한 유물(상세)·퀴즈(오답 선별)의 토대. 실행: (web/에서) node scripts/ai/embed-artifacts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "@huggingface/transformers";

const WEB = process.cwd();
const ART = path.join(WEB, "content", "artifacts");
const items = fs
  .readdirSync(ART)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ART, f), "utf-8")))
  .sort((a, b) => a.id.localeCompare(b.id));

console.log(`임베딩 대상 ${items.length}점 · 모델 로딩(최초 1회 다운로드)…`);
const extract = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");

const docText = (a) =>
  `passage: ${a.title}. 시대 ${a.era}. 분류 ${a.category}. 재질 ${a.material}. ${a.description}${a.usage ? " " + a.usage : ""}`;

const round = (v) => Math.round(v * 100000) / 100000;
const vectors = {};
let n = 0;
for (const a of items) {
  const out = await extract(docText(a), { pooling: "mean", normalize: true });
  vectors[a.id] = Array.from(out.data, round);
  if (++n % 40 === 0) console.log(`  ${n}/${items.length}`);
}
// 클라이언트(의미 검색)용으로 public에도 벡터 + 경량 인덱스 emit
fs.writeFileSync(path.join(WEB, "content", "embeddings.json"), JSON.stringify(vectors));
fs.writeFileSync(path.join(WEB, "public", "embeddings.json"), JSON.stringify(vectors));
const pub = (rel) => fs.existsSync(path.join(WEB, "public", rel));
const index = items.map((a) => {
  const model = pub(`models/${a.id}.glb`);
  const poster = model ? `/models/${a.id}.jpg` : `/images/${a.id}.jpg`;
  return {
    id: a.id,
    title: a.title,
    era: a.era,
    category: a.category,
    mediaKind: model ? "model" : "image",
    posterPath: pub(poster.slice(1)) ? poster : undefined,
  };
});
fs.writeFileSync(path.join(WEB, "public", "artifacts-index.json"), JSON.stringify(index));

// 주제 칩 — 사전 임베딩(브라우저 모델 없이도 즉시 의미 검색 가능)
const TOPICS = [
  "푸른 빛이 아름다운 청자",
  "순백의 백자와 분청사기",
  "부처와 보살 — 불교 미술",
  "왕과 귀족의 황금 장신구",
  "사냥과 채집의 석기 도구",
  "곡식을 저장하던 토기",
  "무덤에 함께 묻은 부장품",
  "제사와 의례에 쓴 청동기",
  "동물 모양으로 빚은 그릇",
  "글자가 새겨진 유물",
];
const topics = [];
for (const label of TOPICS) {
  const out = await extract(`query: ${label}`, { pooling: "mean", normalize: true });
  topics.push({ label, vector: Array.from(out.data, round) });
}
fs.writeFileSync(path.join(WEB, "public", "topics.json"), JSON.stringify(topics));

// 코사인(정규화 벡터 → 내적) top-8 이웃
const ids = items.map((a) => a.id);
const dot = (u, v) => u.reduce((s, x, i) => s + x * v[i], 0);
const similar = {};
for (const id of ids) {
  const u = vectors[id];
  similar[id] = ids
    .filter((o) => o !== id)
    .map((o) => [o, dot(u, vectors[o])])
    .sort((x, y) => y[1] - x[1])
    .slice(0, 8)
    .map(([o]) => o);
}
fs.writeFileSync(path.join(WEB, "content", "similar.json"), JSON.stringify(similar));

const kb = (p) => Math.round(fs.statSync(path.join(WEB, "content", p)).size / 1024);
console.log(`완료: embeddings.json ${kb("embeddings.json")}KB · similar.json ${kb("similar.json")}KB`);
// 표본 점검
for (const s of ["moon-jar", "gold-cap", "nmk-img-23715"]) {
  if (similar[s]) console.log(`  [${s}] 비슷한: ${similar[s].slice(0, 4).join(", ")}`);
}
