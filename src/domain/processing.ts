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

/** Match recovery actions to the actual problem; a service outage is not a bad photo. */
export function processingFollowUp(
  item: NonNullable<VisionSession["followUps"]>[number],
): { message: string; photo: boolean; canSkip: boolean } {
  if (["paused", "worker_error", "structure_failed"].includes(item.type))
    return {
      message:
        "Question preparation is temporarily unavailable. Your material is saved. Try again later.",
      photo: false,
      canSkip: false,
    };
  if (item.type === "library_sync_failed")
    return {
      message:
        "Your questions are prepared, but could not be added to your library yet. Try again to finish saving them.",
      photo: false,
      canSkip: false,
    };
  if (item.type === "pdf_failed")
    return {
      message:
        "This PDF could not be fully read. Try preparing it again, or upload a fresh copy.",
      photo: false,
      canSkip: false,
    };
  if (item.type === "page_failed")
    return {
      message:
        "This page could not be prepared. Try again or add a clearer photo.",
      photo: !!item.pageId,
      canSkip: true,
    };
  return {
    message: item.message,
    photo:
      item.type === "missing_page" ||
      (item.type === "unclear_image" && !!item.pageId),
    canSkip: item.type !== "unclear_image",
  };
}
