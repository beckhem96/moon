/** 생활 장면 양식화 배경 4종 (SVG, 도식적 — 실물 유물과 구분되는 일러스트). */
import type { JSX } from "react";

const COMMON = { viewBox: "0 0 1600 700", preserveAspectRatio: "xMidYMid slice", className: "absolute inset-0 h-full w-full" } as const;

function Prehistoric() {
  return (
    <svg {...COMMON} aria-hidden="true">
      <defs>
        <linearGradient id="bg-pre" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe3f0" />
          <stop offset="0.55" stopColor="#eaddc4" />
          <stop offset="1" stopColor="#cdb18a" />
        </linearGradient>
      </defs>
      <rect width="1600" height="700" fill="url(#bg-pre)" />
      <circle cx="1290" cy="150" r="64" fill="#f6e7b8" />
      <path d="M0 470 Q400 410 820 460 T1600 450 V700 H0 Z" fill="#b89b73" opacity="0.7" />
      <path d="M0 540 Q500 500 1000 540 T1600 530 V700 H0 Z" fill="#a98a5f" />
      {/* 움집 */}
      <path d="M170 540 L300 410 L430 540 Z" fill="#6b5238" />
      <path d="M210 540 L300 455 L390 540 Z" fill="#4f3c28" />
      {/* 나무 */}
      <rect x="1180" y="430" width="18" height="120" fill="#5b4632" />
      <circle cx="1189" cy="420" r="58" fill="#7c8a4f" />
    </svg>
  );
}

function Royal() {
  return (
    <svg {...COMMON} aria-hidden="true">
      <defs>
        <linearGradient id="bg-roy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2540" />
          <stop offset="0.6" stopColor="#4b3f5e" />
          <stop offset="1" stopColor="#6b5a55" />
        </linearGradient>
      </defs>
      <rect width="1600" height="700" fill="url(#bg-roy)" />
      <circle cx="300" cy="160" r="56" fill="#e9d59a" opacity="0.85" />
      {/* 고분(능) */}
      <path d="M0 560 Q300 380 640 560 Z" fill="#3f3447" opacity="0.85" />
      <path d="M760 560 Q1080 360 1460 560 Z" fill="#352b3d" />
      <rect y="555" width="1600" height="145" fill="#241d2c" />
    </svg>
  );
}

function Temple() {
  return (
    <svg {...COMMON} aria-hidden="true">
      <defs>
        <linearGradient id="bg-tmp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe2c6" />
          <stop offset="0.6" stopColor="#e0c79f" />
          <stop offset="1" stopColor="#8a6a4a" />
        </linearGradient>
      </defs>
      <rect width="1600" height="700" fill="url(#bg-tmp)" />
      {/* 기와지붕 */}
      <path d="M260 320 L800 200 L1340 320 L1280 360 L320 360 Z" fill="#5b4636" />
      <rect x="360" y="360" width="880" height="40" fill="#7a5e44" />
      {[440, 600, 760, 920, 1080].map((x) => (
        <rect key={x} x={x} y="400" width="34" height="150" fill="#6b4a2f" />
      ))}
      <rect y="548" width="1600" height="152" fill="#caa97f" />
    </svg>
  );
}

function Craft() {
  return (
    <svg {...COMMON} aria-hidden="true">
      <defs>
        <linearGradient id="bg-craft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e7ddd0" />
          <stop offset="0.6" stopColor="#d9c3a6" />
          <stop offset="1" stopColor="#9c7c58" />
        </linearGradient>
      </defs>
      <rect width="1600" height="700" fill="url(#bg-craft)" />
      {/* 한옥 지붕 */}
      <path d="M120 360 Q360 300 600 360 L560 400 L160 400 Z" fill="#5d4632" />
      <rect x="190" y="400" width="320" height="150" fill="#86684a" />
      {/* 가마 */}
      <path d="M980 520 Q1180 380 1420 520 Z" fill="#7a5a3c" />
      <rect x="1180" y="300" width="26" height="120" fill="#6b4a2f" />
      <circle cx="1193" cy="280" r="20" fill="#cbb9a3" opacity="0.7" />
      <circle cx="1180" cy="240" r="26" fill="#d8cab6" opacity="0.5" />
      <rect y="548" width="1600" height="152" fill="#b9966c" />
    </svg>
  );
}

const MAP: Record<string, () => JSX.Element> = {
  prehistoric: Prehistoric,
  royal: Royal,
  temple: Temple,
  craft: Craft,
};

export default function Backdrop({ setting }: { setting: string }) {
  const C = MAP[setting] ?? Prehistoric;
  return <C />;
}
