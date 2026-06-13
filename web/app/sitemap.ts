import type { MetadataRoute } from "next";
import { artifactRepository } from "@/src/catalog/repository";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moon.example.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/artifacts", "/exhibition", "/about"].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : 0.8,
  }));
  const artifactRoutes = artifactRepository.getAll().map((a) => ({
    url: `${BASE}/artifacts/${a.id}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  return [...staticRoutes, ...artifactRoutes];
}
