import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, DocentProvider } from "../provider";
import { buildSystemPrompt } from "../prompt";

/**
 * Claude(Anthropic) 도슨트 제공자 — 04-plan §8, T-14.
 * 활성화: web/.env.local 에 DOCENT_PROVIDER=anthropic, DOCENT_API_KEY=<키>.
 * 모델은 DOCENT_MODEL로 교체 가능. 기본값은 공개 데모의 비용·속도를 고려한 claude-haiku-4-5
 * (유물당 1~2문장 한국어 해설에 충분). 최고 품질이 필요하면 claude-opus-4-8로 설정.
 */
const MODEL = process.env.DOCENT_MODEL ?? "claude-haiku-4-5";
const MAX_TOKENS = 400; // AC-F4 가드: 짧은 해설(≈300자) — 비용·읽기 흐름

export const anthropicProvider: DocentProvider = {
  stream({ artifact, messages }) {
    const client = new Anthropic({ apiKey: process.env.DOCENT_API_KEY });
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const sdkStream = client.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: buildSystemPrompt(artifact),
            messages: messages.map((m: ChatMessage) => ({
              role: m.role === "docent" ? ("assistant" as const) : ("user" as const),
              content: m.content,
            })),
          });
          for await (const event of sdkStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          // 키 누락·레이트리밋 등은 사용자에게 짧게 알리고 스트림 종료
          console.error("[docent:anthropic]", err instanceof Error ? err.message : err);
          controller.enqueue(
            encoder.encode("\n\n(도슨트 응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.)"),
          );
          controller.close();
        }
      },
    });
  },
};
