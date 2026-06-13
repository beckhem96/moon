import { z } from "zod";

/**
 * 03-domain §5-3: TourAPI 부패 방지 계층 — 외부 응답 타입을 여기서 내부 모델로 변환하고,
 * 이 파일 밖으로는 TourismInfo만 내보낸다.
 */

export interface TourismInfo {
  contentId: string;
  title: string;
  distanceM: number;
  address?: string;
  imageUrl?: string;
}

export interface HeritageSite {
  id: string;
  name: string;
  relation: "출토지" | "원소재지" | "소장처";
  coords: { lat: number; lng: number };
  address?: string;
  note?: string;
}

const TOUR_BASE = "https://apis.data.go.kr/B551011/KorService2/locationBasedList2";

const TourItemSchema = z.object({
  contentid: z.string(),
  title: z.string(),
  dist: z.coerce.number(),
  addr1: z.string().optional(),
  firstimage: z.string().optional(),
});

export async function fetchNearbyTourism(
  site: HeritageSite,
  opts: { rows?: number; radiusM?: number } = {},
): Promise<TourismInfo[]> {
  const key = process.env.TOUR_API_KEY;
  if (!key) throw new Error("TOUR_API_KEY 미설정");

  const params = new URLSearchParams({
    serviceKey: key,
    numOfRows: String(opts.rows ?? 6),
    pageNo: "1",
    MobileOS: "ETC",
    MobileApp: "moon",
    _type: "json",
    arrange: "E", // 거리순
    mapX: String(site.coords.lng),
    mapY: String(site.coords.lat),
    radius: String(opts.radiusM ?? 3000),
    contentTypeId: "12", // 관광지
  });

  const res = await fetch(`${TOUR_BASE}?${params}`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TourAPI HTTP ${res.status}`);
  const json = await res.json();
  const items = json?.response?.body?.items?.item;
  if (!Array.isArray(items)) throw new Error("TourAPI 응답 형식 예상과 다름");

  return items
    .map((raw) => TourItemSchema.safeParse(raw))
    .filter((p): p is { success: true; data: z.infer<typeof TourItemSchema> } => p.success)
    .map(({ data }) => ({
      contentId: data.contentid,
      title: data.title,
      distanceM: Math.round(data.dist),
      address: data.addr1 || undefined,
      imageUrl: data.firstimage || undefined,
    }));
}
