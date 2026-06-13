import Link from "next/link";

/** 전역 푸터 — 출처·라이선스 상시 노출 (헌법 §1-2, T-17) */
export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 text-xs leading-relaxed text-neutral-500">
        <p>
          3D 원천데이터·유물 정보 출처: 국립중앙박물관 (공공누리 제1유형 — 출처표시) · 관광정보:
          한국관광공사 TourAPI. 전체 출처는{" "}
          <Link href="/about" className="underline">
            소개 페이지
          </Link>
          에서 확인할 수 있습니다.
        </p>
        <p className="mt-1 text-neutral-400">
          2026 문화체육관광 AI·데이터 활용 공모전 출품작 · 공공데이터 기반 비영리 문화 향유 서비스
        </p>
      </div>
    </footer>
  );
}
