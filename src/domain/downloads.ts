import type { DownloadPart, Manifest } from "../services/library";
import type { Bundle } from "./types";
export function savedDownloadSelection(manifest: Manifest, saved?: Bundle) {
  if (!saved) return [];
  if (!saved.partialDownload) return manifest.parts.map((p) => p.hash);
  const hashes = new Set(saved.downloadedParts || []),
    old = (saved.downloadedSelection || []) as DownloadPart[];
  return manifest.parts
    .filter(
      (p) =>
        hashes.has(p.hash) ||
        old.some(
          (o) =>
            o.subject === p.subject &&
            o.year === p.year &&
            o.paper === p.paper &&
            o.offset < p.offset + p.count &&
            p.offset < o.offset + o.count,
        ),
    )
    .map((p) => p.hash);
}
export function groupDownloadPapers(parts: DownloadPart[]) {
  const groups = new Map<
    string,
    {
      id: string;
      title: string;
      hashes: string[];
      count: number;
      bytes: number;
    }
  >();
  for (const part of parts) {
    const id = JSON.stringify([part.subject, part.year, part.paper]),
      row = groups.get(id) || {
        id,
        title:
          [...new Set([part.year, part.paper].filter(Boolean))].join(" · ") ||
          "Topic practice",
        hashes: [],
        count: 0,
        bytes: 0,
      };
    row.hashes.push(part.hash);
    row.count += part.count;
    row.bytes += part.bytes;
    groups.set(id, row);
  }
  return [...groups.values()];
}
