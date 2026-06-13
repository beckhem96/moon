import Link from "next/link";

/** 전역 내비게이션 — 페이지 간 이동 일관화 (T-17) */
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-bold tracking-tight">
          <span aria-hidden>🌙</span> moon
        </Link>
        <div className="flex items-center gap-4 text-sm text-neutral-600">
          <Link href="/artifacts" className="hover:text-neutral-900">
            카탈로그
          </Link>
          <Link href="/exhibition" className="hover:text-neutral-900">
            가상 전시관
          </Link>
          <Link href="/about" className="hover:text-neutral-900">
            소개
          </Link>
        </div>
      </nav>
    </header>
  );
}
