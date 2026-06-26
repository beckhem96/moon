import type { ChatMessage, DocentProvider } from "../provider";
import { buildSystemPrompt } from "../prompt";

/**
 * Gemini 도슨트 제공자 — 04-plan §8, T-14 보완.
 * 활성화: web/.env.local 에 DOCENT_PROVIDER=gemini, DOCENT_API_KEY=<키>.
 * 모델은 DOCENT_MODEL로 교체 가능. 기본값은 gemini-2.5-flash.
 */
const MODEL = process.env.DOCENT_MODEL ?? "gemini-2.5-flash";

export const geminiProvider: DocentProvider = {
  stream({ artifact, messages }) {
    const apiKey = process.env.DOCENT_API_KEY;
    const encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        if (!apiKey) {
          console.error("[docent:gemini] DOCENT_API_KEY가 설정되지 않았습니다.");
          controller.enqueue(
            encoder.encode("\n\n(도슨트 응답을 불러오지 못했습니다. API 키 설정을 확인해 주세요.)"),
          );
          controller.close();
          return;
        }

        try {
          const systemPrompt = buildSystemPrompt(artifact);
          const contents = messages.map((m: ChatMessage) => ({
            role: m.role === "docent" ? "model" : "user",
            parts: [{ text: m.content }],
          }));

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: systemPrompt }],
                },
                contents,
                generationConfig: {
                  maxOutputTokens: 400,
                  temperature: 0.2,
                },
              }),
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error("응답 바디 리더를 사용할 수 없습니다.");
          }

          const decoder = new TextDecoder();
          let buffer = "";

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data: ")) {
                try {
                  const data = JSON.parse(trimmed.slice(6));
                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    controller.enqueue(encoder.encode(text));
                  }
                } catch {
                  // 파싱 실패(미완성 청크 등)는 조용히 넘어감
                }
              }
            }
          }

          // 버퍼에 남은 부분 처리
          const trimmed = buffer.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            } catch {
              // ignore
            }
          }

          controller.close();
        } catch (err) {
          console.error("[docent:gemini]", err instanceof Error ? err.message : err);
          controller.enqueue(
            encoder.encode("\n\n(도슨트 응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.)"),
          );
          controller.close();
        }
      },
    });
  },
};
