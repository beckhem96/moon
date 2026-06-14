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
    <section aria-label="AI 도슨트" className="rounded-xl border border-neutral-200">
      <header className="flex items-baseline justify-between border-b border-neutral-100 px-4 py-3">
        <h2 className="font-semibold">AI 도슨트에게 물어보기</h2>
        <span className="text-[11px] text-neutral-500">
          AI 생성 답변 — 사실과 다를 수 있습니다
        </span>
      </header>

      <div ref={logRef} aria-live="polite" className="max-h-80 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500">
            아래 추천 질문을 누르거나 직접 입력해 보세요.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <span
              className={
                m.role === "user"
                  ? "inline-block max-w-[85%] rounded-2xl rounded-br-sm bg-neutral-900 px-3 py-2 text-sm text-white"
                  : "inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-neutral-100 px-3 py-2 text-sm"
              }
            >
              {m.content || "…"}
            </span>
          </div>
        ))}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="border-t border-neutral-100 p-3">
        {messages.length === 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 transition hover:border-neutral-500 hover:text-neutral-900"
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
              capReached ? "이 유물에 대한 질문 한도에 도달했어요" : "유물에 대해 궁금한 점을 물어보세요"
            }
            aria-label="도슨트에게 질문 입력"
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:bg-neutral-50"
          />
          <button
            type="submit"
            disabled={streaming || capReached || !input.trim()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40"
          >
            {streaming ? "답변 중…" : "질문"}
          </button>
        </form>
      </div>
    </section>
  );
}
