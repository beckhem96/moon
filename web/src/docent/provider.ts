import type { Artifact } from "@/src/catalog/schema";

/** 03-domain §5-4: LLM은 이 포트 뒤에 격리 — 구현체 교체는 providers/ 1파일 추가로 끝낸다 */

export type ChatRole = "user" | "docent";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** 도슨트 컨텍스트로 주입되는 유물 정보 (서버에서 저장소로 조회 — 클라이언트 값 신뢰 안 함) */
export type ArtifactContext = Pick<
  Artifact,
  "title" | "era" | "material" | "dimensions" | "description" | "museum" | "attribution"
>;

export interface DocentProvider {
  /** 해설 텍스트를 청크 단위로 스트리밍한다 */
  stream(req: { artifact: ArtifactContext; messages: ChatMessage[] }): ReadableStream<Uint8Array>;
}
