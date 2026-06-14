import type { Metadata } from "next";
import Link from "next/link";
import { artifactRepository } from "@/src/catalog/repository";

export const metadata: Metadata = {
  title: "프로젝트·데이터 출처",
  description: "이 서비스가 사용하는 공공데이터의 출처와 라이선스, 성능 지표를 안내합니다.",
};

/** 헌법 §1-2: 전체 데이터 출처 일람 페이지 */
export default function AboutPage() {
  const artifacts = artifactRepository.getAll();
  const totalSource = artifacts.reduce((s, a) => s + a.asset.metrics.sourceSizeMB, 0);
  const totalPublished = artifacts.reduce((s, a) => s + a.asset.metrics.publishedSizeMB, 0);
  const avgReduction =
    Math.round(
      (artifacts.reduce((s, a) => s + a.asset.metrics.reductionPct, 0) / artifacts.length) * 10,
    ) / 10;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        ← 홈
      </Link>
      <h1 className="mt-2 text-2xl font-bold">프로젝트 소개 · 데이터 출처</h1>

      <section className="mt-6 space-y-3 leading-relaxed">
        <p>
          이 서비스는 공공기관이 개방한 3D 문화유산 원천데이터를 누구나 웹 브라우저에서 바로
          체험할 수 있는 콘텐츠로 가공해 제공합니다. 전문 소프트웨어 없이, 설치 없이, 시간과
          장소의 제약 없이 한국 문화유산을 만나는 것이 목표입니다.
        </p>
        <p className="text-sm text-neutral-500">
          모든 3D 데이터는 웹 전송을 위해 압축·최적화되었으며, 원본의 학술적 정밀도를 대체하지
          않습니다. 연구 목적의 원본 데이터는 아래 출처에서 직접 받으실 수 있습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">사용 데이터와 라이선스</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2 pr-4 font-medium">데이터</th>
                <th className="py-2 pr-4 font-medium">제공기관</th>
                <th className="py-2 pr-4 font-medium">활용 방식</th>
                <th className="py-2 font-medium">라이선스</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b border-neutral-100">
                <td className="py-2 pr-4">
                  <a href="https://www.museum.go.kr/MUSEUM/contents/M0505000000.do" target="_blank" rel="noreferrer" className="underline">
                    소장품 3D 데이터
                  </a>
                </td>
                <td className="py-2 pr-4">국립중앙박물관</td>
                <td className="py-2 pr-4">다운로드 후 웹용 변환·압축(GLB)하여 3D 뷰어 제공</td>
                <td className="py-2">공공누리 제1유형(출처표시)</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-2 pr-4">
                  <a href="https://www.culture.go.kr/data/openapi/openapiView.do?id=82" target="_blank" rel="noreferrer" className="underline">
                    e뮤지엄 유물정보 API
                  </a>
                </td>
                <td className="py-2 pr-4">국립중앙박물관 (문화 공공데이터광장)</td>
                <td className="py-2 pr-4">유물 메타데이터 수집·정제 (연동 준비 중)</td>
                <td className="py-2">공공누리 제1유형</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-2 pr-4">
                  <a href="https://www.data.go.kr/data/15101578/openapi.do" target="_blank" rel="noreferrer" className="underline">
                    국문 관광정보 서비스 (TourAPI)
                  </a>
                </td>
                <td className="py-2 pr-4">한국관광공사 (공공데이터포털)</td>
                <td className="py-2 pr-4">유물 연고지 주변 관광정보 표시 (연동 준비 중)</td>
                <td className="py-2">공공누리 제1유형</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          유물별 상세 출처(원천 페이지 링크)는 각 유물 페이지 하단에 표기되어 있습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">웹 최적화 지표</h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-xl border border-neutral-200 p-4">
            <p className="text-2xl font-bold tabular-nums">{artifacts.length}점</p>
            <p className="mt-1 text-neutral-500">공개 중인 3D 유물</p>
          </li>
          <li className="rounded-xl border border-neutral-200 p-4">
            <p className="text-2xl font-bold tabular-nums">
              {Math.round(totalSource)}MB → {Math.round(totalPublished * 10) / 10}MB
            </p>
            <p className="mt-1 text-neutral-500">원본 대비 총 용량</p>
          </li>
          <li className="rounded-xl border border-neutral-200 p-4">
            <p className="text-2xl font-bold tabular-nums">평균 {avgReduction}%</p>
            <p className="mt-1 text-neutral-500">유물당 용량 절감률</p>
          </li>
        </ul>
        <p className="mt-2 text-xs text-neutral-500">
          Draco 기하 압축과 WebP 텍스처 변환을 적용해 모바일에서도 수 초 안에 감상할 수 있습니다.
        </p>
      </section>
    </main>
  );
}
