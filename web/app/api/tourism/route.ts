import { NextRequest, NextResponse } from "next/server";
import { fetchNearbyTourism } from "@/src/tourism/acl";
import { getSiteById, getTourismSnapshot } from "@/src/tourism/repository";

/** 04-plan §6: GET /api/tourism?siteId= — 캐시 1h, 실패 시 스냅숏 폴백(AC-F5-3) */
export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get("siteId") ?? "";
  const site = getSiteById(siteId);
  if (!site) {
    return NextResponse.json({ error: "연고지를 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const items = await fetchNearbyTourism(site);
    if (items.length === 0) throw new Error("빈 응답");
    return NextResponse.json({ source: "live", items });
  } catch {
    const snapshot = getTourismSnapshot(siteId);
    if (!snapshot) {
      return NextResponse.json({ error: "관광정보를 불러올 수 없습니다." }, { status: 502 });
    }
    return NextResponse.json({
      source: "snapshot",
      collectedAt: snapshot.collectedAt,
      items: snapshot.items,
    });
  }
}
