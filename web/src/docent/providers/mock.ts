import type { ArtifactContext, ChatMessage, DocentProvider } from "../provider";

/**
 * 키 없이 UI를 동작시키는 개발·폴백 제공자 (AC-F4-4).
 * 제출 시점에는 실 LLM 제공자가 연결되어야 한다 (AC-F4-5, T-14).
 */

function composeAnswer(artifact: ArtifactContext, question: string): string {
  const intro = `${artifact.title}에 대해 물어보셨군요.`;
  const base = `${artifact.era} 시대의 ${artifact.material} 유물로, ${artifact.museum}에 소장되어 있습니다.`;
  const desc = artifact.description ? ` ${artifact.description.slice(0, 140)}` : "";
  const guard =
    question.length > 0
      ? " 더 자세한 내용은 곧 연결될 AI 도슨트가 답해 드릴 예정이에요."
      : "";
  return `${intro} ${base}${desc}${guard}\n\n※ 데모 모드 응답입니다 (DOCENT_PROVIDER=mock).`;
}

export const mockProvider: DocentProvider = {
  stream({ artifact, messages }) {
    const lastUser = [...messages].reverse().find((m: ChatMessage) => m.role === "user");
    const text = composeAnswer(artifact, lastUser?.content ?? "");
    const encoder = new TextEncoder();
    // 실제 LLM처럼 청크 단위 스트리밍을 흉내 내 UI 동작을 검증한다
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const chunk of text.match(/.{1,8}/gs) ?? []) {
          controller.enqueue(encoder.encode(chunk));
          await new Promise((r) => setTimeout(r, 18));
        }
        controller.close();
      },
    });
  },
};
