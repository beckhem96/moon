import sharp from "sharp";
// 단순한 성인 실루엣(정면) — 머리/몸통/팔/다리. 약 1.7m 기준, 세로 비율.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="600" viewBox="0 0 240 600">
<g fill="#3b4252">
<circle cx="120" cy="60" r="42"/>
<rect x="92" y="100" width="56" height="20" rx="8"/>
<path d="M70 130 Q120 112 170 130 L182 300 Q184 320 168 322 L150 322 L150 180 L142 180 L150 420 Q152 470 134 470 L128 470 L120 300 L112 470 L106 470 Q88 470 90 420 L98 180 L90 180 L90 322 L72 322 Q56 320 58 300 Z"/>
<rect x="106" y="455" width="18" height="120" rx="7"/>
<rect x="116" y="455" width="18" height="120" rx="7"/>
<ellipse cx="111" cy="585" rx="20" ry="11"/>
<ellipse cx="129" cy="585" rx="20" ry="11"/>
</g></svg>`;
await sharp(Buffer.from(svg)).png().toFile("public/human-silhouette.png");
console.log("ok public/human-silhouette.png");
