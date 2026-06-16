/**
 * PLY 스캔 메시 → GLB 파이프라인 (OBJ가 없고 스캔_PLY만 제공되는 유물용).
 * PLY는 정점 좌표·면만 있고 색/텍스처가 없어 회색 셰이딩 모델로 발행된다(정직: 스캔 형상 그대로).
 * 731K급 고폴리 → meshopt 단순화 + draco로 성능 예산(B1) 충족.
 * 사용법: node scripts/pipeline/run-ply.mjs <slug> [--no-zup] [--rotx deg]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import draco3d from "draco3dgltf";
import { MeshoptSimplifier } from "meshoptimizer";
import { Document, NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, simplify, draco } from "@gltf-transform/functions";

const PIPELINE_VERSION = "1.0.0-ply";
const B1_LIMIT_MB = 8;

const [slug, ...rest] = process.argv.slice(2);
if (!slug) throw new Error("사용법: node scripts/pipeline/run-ply.mjs <slug>");

const webRoot = process.cwd();
const moonRoot = path.resolve(webRoot, "..");
const srcDir = path.join(moonRoot, "assets", "source", slug);
const workDir = path.join(moonRoot, "assets", "work", slug);
const publishPath = path.join(webRoot, "public", "models", `${slug}.glb`);
const metricsPath = path.join(webRoot, "content", "metrics.json");
const mb = (b) => Math.round((b / 1048576) * 100) / 100;
const walk = (d, pred) =>
  fs.readdirSync(d, { recursive: true }).map((f) => path.join(d, f.toString())).filter((f) => fs.statSync(f).isFile() && pred(f));

// 1) PLY 추출
const outerZip = fs.readdirSync(srcDir).find((f) => f.endsWith(".zip"));
if (!outerZip) throw new Error(`원본 zip 없음: ${srcDir}`);
const exDir = path.join(workDir, "ply");
fs.mkdirSync(exDir, { recursive: true });
execFileSync("unzip", ["-o", "-j", "-q", path.join(srcDir, outerZip), "*PLY/*.ply", "-d", exDir]);
const plyPath = walk(exDir, (f) => f.toLowerCase().endsWith(".ply")).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
if (!plyPath) throw new Error("PLY 파일을 찾지 못함");
const sourceSizeMB = mb(fs.statSync(plyPath).size);

// 2) PLY 파싱 → 지오메트리
const buf = fs.readFileSync(plyPath);
const geom = new PLYLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
if (!geom.index) throw new Error("PLY에 면(face) 정보 없음 (포인트 클라우드는 미지원)");
geom.computeVertexNormals();
const position = Float32Array.from(geom.attributes.position.array);
const normal = Float32Array.from(geom.attributes.normal.array);
const indices = Uint32Array.from(geom.index.array);
const triSrc = indices.length / 3;
console.log(`[1/4 reception] ${path.basename(plyPath)} — ${(position.length / 3).toLocaleString()} verts / ${triSrc.toLocaleString()} tris`);

// 3) glTF Document 구성(회색 PBR 머티리얼)
const doc = new Document();
const scene = doc.createScene();
const buffer = doc.createBuffer();
const aPos = doc.createAccessor().setType("VEC3").setArray(position).setBuffer(buffer);
const aNor = doc.createAccessor().setType("VEC3").setArray(normal).setBuffer(buffer);
const aIdx = doc.createAccessor().setType("SCALAR").setArray(indices).setBuffer(buffer);
const mat = doc.createMaterial("scan").setBaseColorFactor([0.82, 0.79, 0.74, 1]).setRoughnessFactor(0.9).setMetallicFactor(0);
const prim = doc.createPrimitive().setAttribute("POSITION", aPos).setAttribute("NORMAL", aNor).setIndices(aIdx).setMaterial(mat);
const node = doc.createNode().setMesh(doc.createMesh().addPrimitive(prim));
scene.addChild(node);

// Z-up 보정(-90° X 기본) + 스케일 정규화(경계구 반지름 1)
const rotxIdx = rest.indexOf("--rotx");
const rotxDeg = rotxIdx >= 0 ? Number(rest[rotxIdx + 1]) : rest.includes("--no-zup") ? 0 : -90;
if (rotxDeg) {
  const h = (rotxDeg * Math.PI) / 360;
  node.setRotation([Math.sin(h), 0, 0, Math.cos(h)]);
}
{
  const { min, max } = getBounds(scene);
  const radius = 0.5 * Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  if (radius > 0) node.setScale([1 / radius, 1 / radius, 1 / radius]);
}

// 4) 최적화: 단순화(목표 ~120K tris) → draco
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.encoder": await draco3d.createEncoderModule(),
  "draco3d.decoder": await draco3d.createDecoderModule(),
});
const targetRatio = Math.min(1, 120000 / triSrc);
await doc.transform(
  dedup(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: targetRatio, error: 0.0015 }),
  prune(),
  draco(),
);

let triangles = 0;
for (const m of doc.getRoot().listMeshes())
  for (const p of m.listPrimitives())
    triangles += Math.floor((p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3);

await io.write(publishPath, doc);
const publishedSizeMB = mb(fs.statSync(publishPath).size);
if (publishedSizeMB > B1_LIMIT_MB) {
  fs.rmSync(publishPath);
  throw new Error(`B1 상한(${B1_LIMIT_MB}MB) 초과: ${publishedSizeMB}MB — 발행 거부`);
}
const reductionPct = Math.round((1 - publishedSizeMB / sourceSizeMB) * 1000) / 10;
console.log(`[3/4 optimize] ${triangles.toLocaleString()} tris (목표비 ${(targetRatio * 100).toFixed(0)}%) · ${publishedSizeMB}MB · 절감 ${reductionPct}%`);

const all = JSON.parse(fs.readFileSync(metricsPath, "utf-8"));
all[slug] = {
  sourceFormat: "PLY",
  sourceSizeMB,
  publishedSizeMB,
  reductionPct,
  triangles,
  pipelineVersion: PIPELINE_VERSION,
  processedAt: new Date().toISOString().slice(0, 10),
};
fs.writeFileSync(metricsPath, JSON.stringify(all, null, 2) + "\n");
console.log(`[4/4 publish] public/models/${slug}.glb + metrics.json 기록 완료`);
