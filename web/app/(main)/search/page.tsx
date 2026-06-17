import type { Metadata } from "next";
import Link from "next/link";
import SemanticSearch from "@/src/search/SemanticSearch";

export const metadata: Metadata = {
  title: "의미 검색",
  description: "이름이 아니라 ‘뜻’으로 유물을 찾습니다 — 온디바이스 AI 임베딩 검색.",
};

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← 홈
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        의미 검색 <span className="align-middle text-xs font-normal text-sky-700">AI 임베딩 · 온디바이스</span>
      </h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">
        키워드가 정확히 일치하지 않아도, 문장의 ‘의미’와 가까운 유물을 찾아줍니다. AI 모델이 브라우저에서
        직접 동작해 검색어가 서버로 전송되지 않습니다.
      </p>
      <SemanticSearch />
    </main>
  );
}
