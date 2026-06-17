/**
 * 퀴즈 뱅크 생성 — 메타데이터 + 의미 임베딩(이웃)으로 문제·오답을 구성. 출력: public/quiz.json
 * 유형: era(시대 맞히기) · name(이름 맞히기, 비슷한 유물을 오답으로) · similar(가장 비슷한 유물 고르기, 임베딩).
 * 실행: (web/에서) node scripts/ai/build-quiz.mjs  (선행: embed-artifacts.mjs)
 */
import fs from "node:fs";
import path from "node:path";

const WEB = process.cwd();
const index = JSON.parse(fs.readFileSync(path.join(WEB, "public", "artifacts-index.json"), "utf-8"));
const similar = JSON.parse(fs.readFileSync(path.join(WEB, "content", "similar.json"), "utf-8"));
const byId = Object.fromEntries(index.map((a) => [a.id, a]));

const withImg = index.filter((a) => a.posterPath);
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sample = (arr, n, exclude = new Set()) => {
  const pool = arr.filter((x) => !exclude.has(x));
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
};
const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

// 연대순 시대(보기로 쓸 만한 한국 시대만)
const ERAS = ["구석기", "신석기", "청동기", "초기철기", "원삼국", "낙랑", "삼국시대", "신라", "통일신라", "고려", "조선"];
const quiz = [];

// 1) 시대 맞히기
for (const a of shuffle(withImg.filter((x) => ERAS.includes(x.era))).slice(0, 12)) {
  const distract = sample(ERAS, 3, new Set([a.era]));
  const options = shuffle([a.era, ...distract]);
  quiz.push({
    id: `era-${a.id}`,
    type: "era",
    prompt: "이 유물은 어느 시대에 만들어졌을까요?",
    image: a.posterPath,
    options: options.map((label) => ({ label })),
    answer: options.indexOf(a.era),
    explain: `${a.title} — ${a.era} · ${a.category}`,
    artifactId: a.id,
  });
}

// 2) 이름 맞히기 (비슷한 유물을 오답으로 → 난이도 ↑)
for (const a of shuffle(withImg).slice(0, 12)) {
  const neigh = (similar[a.id] ?? []).map((id) => byId[id]?.title).filter(Boolean);
  const distract = [...new Set(neigh)].filter((t) => t !== a.title).slice(0, 3);
  while (distract.length < 3) {
    const r = rand(withImg).title;
    if (r !== a.title && !distract.includes(r)) distract.push(r);
  }
  const options = shuffle([a.title, ...distract]);
  quiz.push({
    id: `name-${a.id}`,
    type: "name",
    prompt: "이 사진의 유물 이름은 무엇일까요?",
    image: a.posterPath,
    options: options.map((label) => ({ label })),
    answer: options.indexOf(a.title),
    explain: `${a.title} — ${a.era} · ${a.category}`,
    artifactId: a.id,
  });
}

// 3) 가장 비슷한 유물 고르기 (임베딩 1위 = 정답, 먼 유물 3개 = 오답)
for (const a of shuffle(withImg.filter((x) => (similar[x.id] ?? []).length)).slice(0, 8)) {
  const correct = byId[similar[a.id][0]];
  if (!correct?.posterPath) continue;
  const farIds = sample(
    withImg.map((x) => x.id),
    3,
    new Set([a.id, correct.id, ...(similar[a.id] ?? [])]),
  );
  const opts = shuffle([correct, ...farIds.map((id) => byId[id])]);
  quiz.push({
    id: `sim-${a.id}`,
    type: "similar",
    prompt: "이 유물과 가장 비슷한 유물은? (생김새·쓰임새 기준)",
    image: a.posterPath,
    options: opts.map((o) => ({ label: o.title, image: o.posterPath })),
    answer: opts.indexOf(correct),
    explain: `정답: ${correct.title} (${correct.era} · ${correct.category}) — AI 임베딩이 가장 가깝다고 본 유물`,
    artifactId: a.id,
  });
}

fs.writeFileSync(path.join(WEB, "public", "quiz.json"), JSON.stringify(shuffle(quiz)));
const c = (t) => quiz.filter((q) => q.type === t).length;
console.log(`퀴즈 ${quiz.length}문항 (시대 ${c("era")} · 이름 ${c("name")} · 비슷한유물 ${c("similar")}) → public/quiz.json`);
