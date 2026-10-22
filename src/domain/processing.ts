import type { VisionSession } from "./types";
/** Missing pages are inserted; existing scanned pages must never be replaced for this action. */
export function missingPageInsertion(
  session: VisionSession,
  followUp: NonNullable<VisionSession["followUps"]>[number],
): number | undefined {
  if (!followUp.pageId) return undefined;
  const page = session.pages?.find((p) => p.id === followUp.pageId);
  if (!page)
    throw new Error(
      "The position of this missing page is unavailable. Use the ready questions or upload the complete material again.",
    );
  return page.index;
}
