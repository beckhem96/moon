import type { DocentProvider } from "./provider";
import { mockProvider } from "./providers/mock";

/**
 * 헌법 §6-3: 제공자 선택은 환경변수로, 기본은 mock — 키가 없어도 서비스는 동작한다.
 * 실 LLM 연결(T-14)은 providers/<name>.ts 추가 + 아래 분기 1줄로 끝낸다.
 */
export function getDocentProvider(): DocentProvider {
  const name = process.env.DOCENT_PROVIDER ?? "mock";
  switch (name) {
    // case "anthropic": return anthropicProvider;  // T-14 (U-04 결정 후)
    // case "gemini":    return geminiProvider;
    case "mock":
    default:
      return mockProvider;
  }
}

export const DOCENT_LIMITS = {
  /** 세션(유물)당 사용자 메시지 상한 — 클라이언트·서버 양쪽에서 강제 (AC-F4-4) */
  maxUserMessages: 10,
  /** IP당 분당 요청 상한 */
  ratePerMinute: 5,
} as const;
