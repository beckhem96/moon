/**
 * 3D 에셋 파이프라인 (04-plan §7): reception → convert → optimize → measure → publish
 * 사용법: npm run pipeline -- <slug> [--texsize 2048] [--quality 80]
 * 입력:  ../assets/source/<slug>/*.zip (국립중앙박물관 패키지, SOURCE.md 동봉)
 * 출력:  public/models/<slug>.glb + content/metrics.json 갱신
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import obj2gltf from "obj2gltf";
import sharp from "sharp";
import draco3d from "draco3dgltf";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, draco, textureCompress } from "@gltf-transform/functions";

const PIPELINE_VERSION = "1.0.0";
const B1_TARGET_MB = 5;
const B1_LIMIT_MB = 8;

const [slug, ...rest] = process.argv.slice(2);
if (!slug) {
  console.error("사용법: npm run pipeline -- <slug>");
  process.exit(1);
}
// 유물별 영구 보정 플래그 (회전 등) — CLI 인자가 우선
const OVERRIDES_PATH = path.join(process.cwd(), "content", "pipeline-overrides.json");
const overrides = fs.existsSync(OVERRIDES_PATH)
  ? JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf-8"))
  : {};
rest.unshift(...(overrides[slug] ?? []));

const texsize = Number(rest[rest.indexOf("--texsize") + 1]) || 2048;
const quality = Number(rest[rest.indexOf("--quality") + 1]) || 80;

const webRoot = process.cwd();
const moonRoot = path.resolve(webRoot, "..");
const srcDir = path.join(moonRoot, "assets", "source", slug);
const workDir = path.join(moonRoot, "assets", "work", slug);
const publishPath = path.join(webRoot, "public", "models", `${slug}.glb`);
const metricsPath = path.join(webRoot, "content", "metrics.json");

const mb = (bytes) => Math.round((bytes / 1024 / 1024) * 100) / 100;
const walk = (dir, pred) =>
  fs.readdirSync(dir, { recursive: true })
    .map((f) => path.join(dir, f.toString()))
    .filter((f) => fs.statSync(f).isFile() && pred(f));

// ── 1. reception: 외곽 zip 추출 (+ 신형 패키지의 중첩 OBJ zip 추출) ──────────
const outerZip = fs.readdirSync(srcDir).find((f) => f.endsWith(".zip"));
if (!outerZip) throw new Error(`원본 zip 없음: ${srcDir}`);
const extractDir = path.join(workDir, "extract");
if (!fs.existsSync(extractDir)) {
  fs.mkdirSync(extractDir, { recursive: true });
  execFileSync("unzip", ["-o", "-q", path.join(srcDir, outerZip), "*OBJ*", "-d", extractDir]);
  for (const nested of walk(extractDir, (f) => f.endsWith(".zip"))) {
    execFileSync("unzip", ["-o", "-q", nested, "-d", path.dirname(nested)]);
  }
}
const objPath = walk(extractDir, (f) => f.toLowerCase().endsWith(".obj"))[0];
if (!objPath) throw new Error("OBJ 파일을 찾지 못함");
const objDir = path.dirname(objPath);
console.log(`[1/5 reception] ${path.basename(objPath)}`);

// ── 2. convert: MTL 경로 정정(제작 PC 절대경로 → 로컬 파일명) 후 OBJ → GLB ──
// 인코딩 주의: 재질명이 CP949로 깨져 있을 수 있어 latin1(바이트 보존)으로 읽고 쓴다.
// UTF-8로 읽으면 U+FFFD 치환이 일어나 OBJ의 usemtl(원본 바이트)과 불일치 → 텍스처 누락.
const mtls = walk(objDir, (f) => f.toLowerCase().endsWith(".mtl"));
let renameMaterial = false;
for (const mtl of mtls) {
  const texFiles = fs.readdirSync(objDir).filter((f) => /\.(jpe?g|png)$/i.test(f));
  let txt = fs.readFileSync(mtl, "latin1").replace(/\r\n?/g, "\n").replace(
    /^(\s*(?:map_Kd|map_Ks|map_Ke|map_Ka|map_d|map_bump|bump|norm|disp|refl)\s+)(.+)$/gim,
    (_, key, p) => {
      let name = path.basename(p.trim().replace(/\\/g, "/"));
      // 원본 MTL의 파일명 오타(예: su…↔ssu…) 복구 — 접미사 매칭으로 실제 파일 탐색
      if (!fs.existsSync(path.join(objDir, name))) {
        const fix =
          texFiles.find((f) => f.toLowerCase().endsWith(name.toLowerCase())) ||
          texFiles.find((f) => name.toLowerCase().endsWith(f.toLowerCase()));
        if (fix) {
          console.log(`[2/5 convert] MTL 텍스처명 정정: ${name} → ${fix}`);
          name = fix;
        }
      }
      return key + name;
    },
  );
  // 단일 재질이면 비ASCII 이름을 안전한 ASCII로 통일 (OBJ 쪽도 함께 교체)
  if (mtls.length === 1 && (txt.match(/^newmtl /gim) || []).length === 1) {
    txt = txt.replace(/^newmtl .*$/im, "newmtl material0");
    renameMaterial = true;
  }
  fs.writeFileSync(mtl, txt, "latin1");
}
if (renameMaterial) {
  const objTxt = fs.readFileSync(objPath, "latin1");
  fs.writeFileSync(objPath, objTxt.replace(/^usemtl .*$/gim, "usemtl material0"), "latin1");
}
// 원본 크기는 사전 리사이즈 전에 측정 (B4 절감률의 분모는 진짜 원본이어야 함)
const sourceFiles = walk(objDir, (f) => !f.endsWith(".zip"));
const sourceSizeMB = mb(sourceFiles.reduce((s, f) => s + fs.statSync(f).size, 0));

// 텍스처 사전 정규화: ① 비정상 JPG 마커 재인코딩(gltf-transform 거부 방지)
// ② 최종 출력 상한(texsize)으로 선리사이즈 — 8K 원본이 obj2gltf 메모리 가드(maxMemoryUsage)에
//    걸려 텍스처가 통째로 무시되는 문제 방지 + 변환 속도 개선
for (const tex of walk(objDir, (f) => /\.(jpe?g|png)$/i.test(f))) {
  const base = sharp(tex, { limitInputPixels: false }).resize(texsize, texsize, { fit: "inside", withoutEnlargement: true });
  const buf = /\.png$/i.test(tex)
    ? await base.png().toBuffer()
    : await base.jpeg({ quality: 95 }).toBuffer();
  fs.writeFileSync(tex, buf);
}
const glbBuffer = await obj2gltf(objPath, { binary: true });
const convertedPath = path.join(workDir, "converted.glb");
fs.writeFileSync(convertedPath, glbBuffer);
console.log(`[2/5 convert] OBJ 일습 ${sourceSizeMB}MB → GLB ${mb(glbBuffer.length)}MB`);

// ── 3. optimize: 노멀맵 보강 → webp 텍스처 압축 → draco ─────────────────────
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.encoder": await draco3d.createEncoderModule(),
  "draco3d.decoder": await draco3d.createDecoderModule(),
});
const doc = await io.read(convertedPath);

// 박물관 스캔 원본은 대개 Z-up(높이=Z) — glTF는 Y-up이므로 기본 -90°(X축) 회전 보정.
// 원본 축이 다른 유물은 --no-zup(회전 없음) 또는 --rotx <deg>로 개별 보정 (content/pipeline-overrides.json).
const rotxIdx = rest.indexOf("--rotx");
const rotxDeg = rotxIdx >= 0 ? Number(rest[rotxIdx + 1]) : rest.includes("--no-zup") ? 0 : -90;
const rotyIdx = rest.indexOf("--roty"); // 정면축 보정(¾ 각도 등 감상 방향)
const rotyDeg = rotyIdx >= 0 ? Number(rest[rotyIdx + 1]) : 0;
if (rotxDeg || rotyDeg) {
  const hx = (rotxDeg * Math.PI) / 360;
  const hy = (rotyDeg * Math.PI) / 360;
  const qx = [Math.sin(hx), 0, 0, Math.cos(hx)];
  const qy = [0, Math.sin(hy), 0, Math.cos(hy)];
  // q = qy ⊗ qx (X축 보정 후 월드 Y 요)
  const q = [
    qy[3] * qx[0] + qy[0] * qx[3] + qy[1] * qx[2] - qy[2] * qx[1],
    qy[3] * qx[1] - qy[0] * qx[2] + qy[1] * qx[3] + qy[2] * qx[0],
    qy[3] * qx[2] + qy[0] * qx[1] - qy[1] * qx[0] + qy[2] * qx[3],
    qy[3] * qx[3] - qy[0] * qx[0] - qy[1] * qx[1] - qy[2] * qx[2],
  ];
  for (const scene of doc.getRoot().listScenes())
    for (const node of scene.listChildren()) node.setRotation(q);
}
// 스케일 정규화: 원본 단위가 유물마다 제각각(mm/cm) → 경계구 반지름 1유닛으로 통일.
// 뷰어 카메라 near/far·전시관 배치(F6)가 단위에 의존하지 않게 하는 데이터 위생.
for (const scene of doc.getRoot().listScenes()) {
  const { min, max } = getBounds(scene);
  const radius = 0.5 * Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  if (radius > 0) {
    const s = 1 / radius;
    for (const node of scene.listChildren()) node.setScale([s, s, s]);
  }
}

const norJpg = sourceFiles.find((f) => /_nor\.(jpe?g|png)$/i.test(f));
const materials = doc.getRoot().listMaterials();
if (norJpg && materials.length && !materials.some((m) => m.getNormalTexture())) {
  const tex = doc.createTexture("normal")
    .setImage(fs.readFileSync(norJpg))
    .setMimeType(/\.png$/i.test(norJpg) ? "image/png" : "image/jpeg");
  for (const m of materials) m.setNormalTexture(tex);
  console.log("[3/5 optimize] MTL의 norm 누락 → 노멀맵 수동 부착");
}
await doc.transform(
  dedup(),
  prune(),
  weld(),
  textureCompress({ encoder: sharp, targetFormat: "webp", quality, resize: [texsize, texsize] }),
  draco(),
);

// ── 4. measure: 지표 산출 + 성능 예산 B1 강제 (헌법 §3) ─────────────────────
let triangles = 0;
for (const mesh of doc.getRoot().listMeshes())
  for (const prim of mesh.listPrimitives())
    triangles += Math.floor((prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION").getCount()) / 3);

await io.write(publishPath, doc);
const publishedSizeMB = mb(fs.statSync(publishPath).size);
const reductionPct = Math.round((1 - publishedSizeMB / sourceSizeMB) * 1000) / 10;

if (publishedSizeMB > B1_LIMIT_MB) {
  fs.rmSync(publishPath);
  console.error(`✗ B1 상한(${B1_LIMIT_MB}MB) 초과: ${publishedSizeMB}MB — 발행 거부 (도메인 불변 규칙 3)`);
  process.exit(1);
}
const metrics = {
  sourceFormat: "OBJ",
  sourceSizeMB,
  publishedSizeMB,
  reductionPct,
  triangles,
  pipelineVersion: PIPELINE_VERSION,
  processedAt: new Date().toISOString().slice(0, 10),
};
console.log(`[4/5 measure] ${publishedSizeMB}MB · ${triangles.toLocaleString()} tris · 절감 ${reductionPct}%` +
  (publishedSizeMB > B1_TARGET_MB ? " ⚠ B1 목표(5MB) 초과 — --texsize 1024 재시도 권장" : " ✓ B1 목표 충족"));

// ── 5. publish: metrics.json 갱신 ────────────────────────────────────────────
const all = JSON.parse(fs.readFileSync(metricsPath, "utf-8"));
all[slug] = metrics;
fs.writeFileSync(metricsPath, JSON.stringify(all, null, 2) + "\n");
console.log(`[5/5 publish] public/models/${slug}.glb + metrics.json 기록 완료`);
