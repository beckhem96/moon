"use client";

import { useRef, useState } from "react";

/** 02-spec F4 AI 도슨트 — AC-F4-1 스트리밍 / AC-F4-2 추천 질문 칩 / AC-F4-3 "AI 생성" 고지 / AC-F4-4 세션 상한 */

interface Msg {
  role: "user" | "docent";
  content: string;
}

const MAX_USER_MESSAGES = 10;

export default function DocentChat({
  artifactId,
  suggestedQuestions,
}: {
  artifactId: string;
  suggestedQuestions: string[];
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const userCount = messages.filter((m) => m.role === "user").length;
  const capReached = userCount >= MAX_USER_MESSAGES;

  async function send(question: string) {
    const q = question.trim();
    if (!q || streaming || capReached) return;
    setError(null);
    setInput("");

    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...next, { role: "docent", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/docent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactId, messages: next }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text().catch(() => "응답 오류"));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((cur) => {
          const copy = [...cur];
          copy[copy.length - 1] = {
            role: "docent",
            content: copy[copy.length - 1].content + chunk,
          };
          return copy;
        });
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "도슨트 연결에 실패했습니다.");
      setMessages((cur) => (cur[cur.length - 1]?.content === "" ? cur.slice(0, -1) : cur));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <section aria-label="AI 도슨트" className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 bg-neutral-50/50">
        <h2 className="font-semibold text-sm text-neutral-800 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse"></span>
          AI 도슨트 대화
        </h2>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-900 transition hover:underline"
            >
              대화 초기화
            </button>
          )}
          <span className="text-[10px] text-neutral-400 select-none">
            AI 답변 · 실시간 생성
          </span>
        </div>
      </header>

      <div ref={logRef} aria-live="polite" className="max-h-80 space-y-3.5 overflow-y-auto px-4 py-4 min-h-[120px] bg-neutral-50/20">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 text-center">
            <p className="text-sm text-neutral-500">
              유물에 대해 궁금한 점을 물어보세요.
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              아래 추천 질문을 선택하거나 직접 입력할 수 있습니다.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={
                m.role === "user"
                  ? "inline-block max-w-[85%] rounded-2xl rounded-br-sm bg-neutral-900 px-3.5 py-2 text-sm text-white shadow-sm"
                  : "inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white border border-neutral-200/80 px-3.5 py-2 text-sm text-neutral-800 shadow-sm"
              }
            >
              {m.content || (
                <span className="flex items-center gap-1 py-1" aria-label="답변을 작성하는 중">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"></span>
                </span>
              )}
            </span>
          </div>
        ))}
        {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg p-2.5">{error}</p>}
      </div>

      <div className="border-t border-neutral-100 p-3 bg-white">
        {suggestedQuestions.length > 0 && !capReached && (
          <div className="mb-3 flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] font-medium text-neutral-400 select-none">추천 질문:</span>
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                disabled={streaming}
                className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming || capReached}
            placeholder={
              capReached ? "이 유물에 대한 질문 한도(10회)에 도달했어요" : "질문을 자유롭게 입력해보세요"
            }
            aria-label="도슨트에게 질문 입력"
            className="flex-1 rounded-lg border border-neutral-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:bg-neutral-50"
          />
          <button
            type="submit"
            disabled={streaming || capReached || !input.trim()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40"
          >
            {streaming ? "답변 중" : "전송"}
          </button>
        </form>
      </div>
    </section>
  );
}
