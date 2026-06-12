import { z } from "zod";
import { artifactRepository } from "@/src/catalog/repository";
import { getDocentProvider, DOCENT_LIMITS } from "@/src/docent";

/** 04-plan §6: POST /api/docent — 평문 텍스트 청크 스트리밍. 컨텍스트는 서버에서 저장소로 조회. */

const BodySchema = z.object({
  artifactId: z.string().regex(/^[a-z0-9-]+$/),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "docent"]),
        content: z.string().min(1).max(500),
      }),
    )
    .min(1)
    .max(DOCENT_LIMITS.maxUserMessages * 2),
});

// 인메모리 레이트리밋 — 서버리스 인스턴스별 best-effort (04-plan §8에 한계 명시)
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const list = (hits.get(ip) ?? []).filter((t) => t > windowStart);
  if (list.length >= DOCENT_LIMITS.ratePerMinute) return true;
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5_000) hits.clear(); // 메모리 가드
  return false;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return new Response("요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.", { status: 429 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response("잘못된 요청입니다.", { status: 400 });
  }

  const artifact = artifactRepository.getById(parsed.data.artifactId);
  if (!artifact) {
    return new Response("유물을 찾을 수 없습니다.", { status: 404 });
  }

  const stream = getDocentProvider().stream({
    artifact,
    messages: parsed.data.messages,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
