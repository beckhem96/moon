import type { Metadata } from "next";
import Link from "next/link";
import QuizGame from "@/src/quiz/QuizGame";

export const metadata: Metadata = {
  title: "유물 퀴즈",
  description: "이미지와 AI 임베딩으로 만든 문제로 즐기며 배우는 한국 문화유산 퀴즈.",
};

export default function QuizPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← 홈</Link>
      <h1 className="mt-2 text-2xl font-bold">
        유물 퀴즈 <span className="align-middle text-xs font-normal text-sky-700">AI 임베딩 출제</span>
      </h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">
        사진을 보고 시대·이름을 맞히고, AI가 고른 ‘가장 비슷한 유물’도 찾아보세요. 한 판 8문제.
      </p>
      <QuizGame />
    </main>
  );
}
