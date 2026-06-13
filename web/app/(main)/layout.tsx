import SiteHeader from "@/src/shared/SiteHeader";
import SiteFooter from "@/src/shared/SiteFooter";

/** 일반 페이지 공통 셸 (헤더+푸터). 임베드(/embed)·API는 이 레이아웃 밖이라 적용되지 않는다. */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </>
  );
}
