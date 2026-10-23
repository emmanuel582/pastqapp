import { Image, type ImageRef } from "expo-image";
import { poses } from "../data/poses";
export type ScholarImages = Record<string, ImageRef>;
let users = 0,
  decoded: ScholarImages = {};
let loading: Promise<ScholarImages> | null = null;
function releaseUnused() {
  if (users || loading) return;
  for (const image of Object.values(decoded)) image.release();
  decoded = {};
}
/** Share the small bundled pose set; retain decoded pixels only while mascot views use it. */
export function acquireScholarFrames() {
  users++;
  if (!loading && !Object.keys(decoded).length) {
    loading = Promise.all(
      Object.entries(poses).map(async ([key, source]) => {
        try {
          return [key, await Image.loadAsync(source)] as const;
        } catch {
          return null;
        } // A failed warmup still permits the normal bundled-image loader.
      }),
    )
      .then((entries) => {
        decoded = Object.fromEntries(
          entries.filter(
            (entry): entry is readonly [string, ImageRef] => entry !== null,
          ),
        );
        return decoded;
      })
      .finally(() => {
        loading = null;
        releaseUnused();
      });
  }
  let released = false;
  return {
    ready: loading || Promise.resolve(decoded),
    release() {
      if (released) return;
      released = true;
      users--;
      releaseUnused();
    },
  };
}
