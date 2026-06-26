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
            
            // Normalize carriage returns to standard newlines
            const normalized = buffer.replace(/\r\n/g, "\n");
            const events = normalized.split("\n\n");
            
            // Keep the last (potentially incomplete) event in the buffer
            buffer = events.pop() ?? "";

            for (const event of events) {
              const eventTrimmed = event.trim();
              if (!eventTrimmed) continue;

              const lines = eventTrimmed.split("\n");
              let dataContent = "";

              for (const line of lines) {
                const lineTrimmed = line.trim();
                if (lineTrimmed.startsWith("data:")) {
                  // Handle optional space after data:
                  const valuePart = lineTrimmed.slice(5).startsWith(" ")
                    ? lineTrimmed.slice(6)
                    : lineTrimmed.slice(5);
                  dataContent += valuePart;
                }
              }

              const dataContentTrimmed = dataContent.trim();
              if (!dataContentTrimmed || dataContentTrimmed === "[DONE]") {
                continue;
              }

              try {
                const data = JSON.parse(dataContentTrimmed);
                if (data.error) {
                  console.error("[docent:gemini] API error during stream:", data.error);
                  controller.enqueue(
                    encoder.encode(`\n\n(오류 발생: ${data.error.message || "알 수 없는 API 오류"})`)
                  );
                  return;
                }
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  controller.enqueue(encoder.encode(text));
                }
              } catch (err) {
                console.warn("[docent:gemini] Failed to parse SSE event JSON:", err, "Content:", dataContentTrimmed);
              }
            }
          }

          // Process remaining buffer
          const normalizedRemaining = buffer.replace(/\r\n/g, "\n").trim();
          if (normalizedRemaining) {
            const lines = normalizedRemaining.split("\n");
            let dataContent = "";
            for (const line of lines) {
              const lineTrimmed = line.trim();
              if (lineTrimmed.startsWith("data:")) {
                const valuePart = lineTrimmed.slice(5).startsWith(" ")
                  ? lineTrimmed.slice(6)
                  : lineTrimmed.slice(5);
                dataContent += valuePart;
              }
            }
            const dataContentTrimmed = dataContent.trim();
            if (dataContentTrimmed && dataContentTrimmed !== "[DONE]") {
              try {
                const data = JSON.parse(dataContentTrimmed);
                if (!data.error) {
                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    controller.enqueue(encoder.encode(text));
                  }
                }
              } catch {
                // ignore
              }
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
