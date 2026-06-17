"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

/** 02-spec F11 의미 검색 — 온디바이스 임베딩(transformers.js)으로 '뜻'으로 유물을 찾는다.
 *  주제 칩은 빌드 시 사전 임베딩되어 모델 없이 즉시 동작, 자유 입력은 브라우저 모델을 지연 로드. */

interface IndexItem {
  id: string;
  title: string;
  era: string;
  category: string;
  mediaKind: "model" | "image";
  posterPath?: string;
}
type Vectors = Record<string, number[]>;
interface Topic {
  label: string;
  vector: number[];
}

const dot = (u: number[], v: number[]) => {
  let s = 0;
  for (let i = 0; i < u.length; i++) s += u[i] * v[i];
  return s;
};

export default function SemanticSearch() {
  const [index, setIndex] = useState<IndexItem[]>([]);
  const embRef = useRef<Vectors>({});
  const [topics, setTopics] = useState<Topic[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<IndexItem[]>([]);
  const [active, setActive] = useState<string>("");
  const [status, setStatus] = useState<"init" | "ready" | "loading" | "error">("init");
  const modelRef = useRef<((t: string, o: unknown) => Promise<{ data: Float32Array }>) | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/artifacts-index.json").then((r) => r.json()),
      fetch("/embeddings.json").then((r) => r.json()),
      fetch("/topics.json").then((r) => r.json()),
    ])
      .then(([idx, emb, tp]) => {
        setIndex(idx);
        embRef.current = emb;
        setTopics(tp);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const rankByVector = (vec: number[], label: string) => {
    const emb = embRef.current;
    const scored = index
      .map((it) => ({ it, score: emb[it.id] ? dot(vec, emb[it.id]) : -1 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 18)
      .map((s) => s.it);
    setResults(scored);
    setActive(label);
  };

  const keywordFallback = (text: string) => {
    const t = text.trim();
    setResults(index.filter((it) => it.title.includes(t)).slice(0, 18));
    setActive(text);
  };

  const search = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    try {
      if (!modelRef.current) {
        setStatus("loading");
        const { pipeline, env } = await import("@huggingface/transformers");
        env.allowLocalModels = false;
        const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", {
          dtype: "q8",
        });
        modelRef.current = extractor as unknown as typeof modelRef.current;
        setStatus("ready");
      }
      const out = await modelRef.current!(`query: ${t}`, { pooling: "mean", normalize: true });
      rankByVector(Array.from(out.data), t);
    } catch {
      setStatus("error");
      keywordFallback(t);
    }
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
        }}
        className="flex gap-2"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="뜻으로 찾기 — 예: 둥근 항아리, 왕의 무덤 부장품"
          aria-label="의미 검색어"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {status === "loading" ? "AI 준비 중…" : "검색"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {topics.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => rankByVector(t.vector, t.label)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              active === t.label
                ? "border-sky-600 bg-sky-600 text-white"
                : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        {status === "loading" && "🧠 브라우저에서 AI 임베딩 모델을 불러오는 중입니다(최초 1회)…"}
        {status === "error" && "AI 모델을 불러오지 못해 이름 검색으로 대체합니다."}
        {status === "ready" && active && `“${active}” 의미와 가까운 순서로 ${results.length}점`}
        {status === "ready" && !active && "주제 칩을 누르거나 문장을 입력해 ‘뜻’으로 유물을 찾아보세요. (온디바이스 AI — 검색어는 서버로 전송되지 않습니다)"}
      </p>

      {results.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((a) => (
            <li key={a.id}>
              <Link
                href={`/artifacts/${a.id}`}
                className="group block overflow-hidden rounded-xl border border-neutral-200 transition hover:border-neutral-400 hover:shadow-md"
              >
                <div className="relative aspect-square bg-neutral-900">
                  <span
                    className={`absolute left-1.5 top-1.5 z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      a.mediaKind === "model" ? "bg-sky-700 text-white" : "bg-white/90 text-neutral-700"
                    }`}
                  >
                    {a.mediaKind === "model" ? "3D" : "이미지"}
                  </span>
                  {a.posterPath && (
                    <Image src={a.posterPath} alt={a.title} fill sizes="(max-width:640px) 50vw, 25vw" className="object-cover transition group-hover:scale-105" />
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{a.era} · {a.category}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
