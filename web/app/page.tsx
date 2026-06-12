import Link from "next/link";
import { artifactRepository } from "@/src/catalog/repository";

export default function Home() {
  const artifacts = artifactRepository.getAll();

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">문화유산 3D 체험 (가칭 moon)</h1>
      <p className="mt-2 text-neutral-500">
        공공 3D 문화유산 데이터를 웹에서 바로 돌려보세요 — 시공간 제약 없는 한국 문화유산 탐방.
      </p>

      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {artifacts.map((a) => (
          <li key={a.id}>
            <Link
              href={`/artifacts/${a.id}`}
              className="block rounded-xl border border-neutral-200 p-4 transition hover:border-neutral-400 hover:shadow-sm"
            >
              <span className="font-medium">{a.title}</span>
              <span className="mt-1 block text-xs text-neutral-400">
                {a.era} · {a.material}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <footer className="mt-12 text-xs text-neutral-400">
        데이터 출처: 국립중앙박물관 (공공누리 제1유형 — 출처표시) 외. 자세한 일람은 추후 /about에서.
      </footer>
    </main>
  );
}
