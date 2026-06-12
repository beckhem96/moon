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
import { NodeIO } from "@gltf-transform/core";
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
for (const mtl of walk(objDir, (f) => f.toLowerCase().endsWith(".mtl"))) {
  const fixed = fs.readFileSync(mtl, "utf-8").replace(
    /^(\s*(?:map_Kd|map_Ks|map_Ke|map_bump|bump|norm|disp)\s+)(.+)$/gim,
    (_, key, p) => key + path.basename(p.trim().replace(/\\/g, "/")),
  );
  fs.writeFileSync(mtl, fixed);
}
const sourceFiles = walk(objDir, (f) => !f.endsWith(".zip"));
const sourceSizeMB = mb(sourceFiles.reduce((s, f) => s + fs.statSync(f).size, 0));
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

// 박물관 스캔 원본은 Z-up(높이=Z) — glTF는 Y-up이므로 -90°(X축) 회전 보정. 예외 유물은 --no-zup
if (!rest.includes("--no-zup")) {
  for (const scene of doc.getRoot().listScenes())
    for (const node of scene.listChildren())
      node.setRotation([-Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
}

const norJpg = sourceFiles.find((f) => /_nor\.(jpe?g|png)$/i.test(f));
const materials = doc.getRoot().listMaterials();
if (norJpg && materials.length && !materials.some((m) => m.getNormalTexture())) {
  const tex = doc.createTexture("normal")
    .setImage(fs.readFileSync(norJpg))
    .setMimeType("image/jpeg");
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
