import type { Bundle, VisionSession } from "../domain/types";
import * as records from "../storage/records";
import { request } from "./api";
import { saveBundle } from "./library";
/** Confirmation is server-owned and survives app reinstall, another device, or a notification tap. */
export async function confirmedMaterial(
  owner: string,
  session: Pick<VisionSession, "id" | "approvedAt">,
): Promise<string | null> {
  const completed = await records.read<string>(
    owner,
    "confirmed-material",
    session.id,
  );
  if (!session.approvedAt && ("approvedAt" in session || !completed))
    return null;
  const id = completed || session.id;
  const saved = await records.read<Bundle>(owner, "bundle", id);
  if (!saved) {
    const bundle = await request<Bundle>(
      "/api/vision/materials/" + encodeURIComponent(id),
      {},
      true,
    );
    await saveBundle(owner, { ...bundle, ownerId: owner });
  }
  return id;
}
