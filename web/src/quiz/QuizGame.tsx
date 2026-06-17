"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

/** 02-spec F12 유물 퀴즈 — 메타데이터 + AI 임베딩으로 생성된 문항으로 즐기며 배우는 게임. */

interface Option { label: string; image?: string }
interface Question {
  id: string;
  type: string;
  prompt: string;
  image?: string;
  options: Option[];
  answer: number;
  explain: string;
  artifactId: string;
}

const ROUND = 8;
const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v);

export default function QuizGame() {
  const [bank, setBank] = useState<Question[]>([]);
  const [round, setRound] = useState<Question[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/quiz.json").then((r) => r.json()).then((b: Question[]) => {
      setBank(b);
      setRound(shuffle(b).slice(0, ROUND));
    });
  }, []);

  const start = () => {
    setRound(shuffle(bank).slice(0, ROUND));
    setI(0); setPicked(null); setScore(0); setDone(false);
  };

  const q = round[i];
  const hasImageOptions = useMemo(() => q?.options.some((o) => o.image), [q]);

  if (!q) return <p className="text-sm text-neutral-500">퀴즈를 불러오는 중…</p>;

  if (done) {
    const pct = Math.round((score / round.length) * 100);
    return (
      <div className="rounded-2xl border border-neutral-200 p-8 text-center">
        <p className="text-sm text-neutral-500">결과</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">{score} / {round.length}</p>
        <p className="mt-1 text-neutral-600">
          {pct >= 80 ? "👏 문화유산 박사!" : pct >= 50 ? "🙂 좋아요, 한 걸음 더!" : "🌱 이제 시작이에요!"}
        </p>
        <button type="button" onClick={start} className="mt-5 rounded-xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700">
          다시 도전
        </button>
      </div>
    );
  }

  const select = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === q.answer) setScore((s) => s + 1);
  };
  const next = () => {
    if (i + 1 >= round.length) setDone(true);
    else { setI(i + 1); setPicked(null); }
  };
  const optClass = (idx: number) => {
    if (picked === null) return "border-neutral-300 hover:border-sky-500 hover:bg-sky-50";
    if (idx === q.answer) return "border-green-500 bg-green-50";
    if (idx === picked) return "border-red-400 bg-red-50";
    return "border-neutral-200 opacity-60";
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-sm text-neutral-500">
        <span>문제 {i + 1} / {round.length}</span>
        <span className="tabular-nums">점수 {score}</span>
      </div>

      {q.image && (
        <div className="relative mx-auto aspect-video max-w-md overflow-hidden rounded-xl bg-neutral-900">
          <Image src={q.image} alt="문제 유물 이미지" fill sizes="(max-width:640px) 100vw, 28rem" className="object-contain" />
        </div>
      )}
      <h2 className="mt-4 text-center text-lg font-semibold">{q.prompt}</h2>

      <div className={`mt-4 grid gap-2 ${hasImageOptions ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"}`}>
        {q.options.map((o, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => select(idx)}
            disabled={picked !== null}
            aria-pressed={picked === idx}
            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 text-sm transition ${optClass(idx)}`}
          >
            {o.image && (
              <span className="relative h-24 w-full overflow-hidden rounded-lg bg-neutral-900">
                <Image src={o.image} alt={o.label} fill sizes="120px" className="object-contain" />
              </span>
            )}
            <span className="font-medium">{o.label}</span>
          </button>
        ))}
      </div>

      {picked !== null && (
        <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-center">
          <p className={`font-semibold ${picked === q.answer ? "text-green-700" : "text-red-600"}`}>
            {picked === q.answer ? "정답!" : "아쉬워요"}
          </p>
          <p className="mt-1 text-sm text-neutral-700">{q.explain}</p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <Link href={`/artifacts/${q.artifactId}`} className="text-sm text-sky-700 hover:underline">유물 자세히 보기 →</Link>
            <button type="button" onClick={next} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
              {i + 1 >= round.length ? "결과 보기" : "다음 문제"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
