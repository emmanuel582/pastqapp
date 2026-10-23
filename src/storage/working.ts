import * as records from "./records";
import { withSession, waitForSession } from "./sessionQueue";
import {
  emptyWorkingPaper,
  validateWorkingPaper,
  type WorkingPaper,
} from "../domain/working";
import type { AttemptHeader } from "./practice";
export const workingKind = (attemptId: string) => "working:" + attemptId;
export async function readWorkingPaper(
  owner: string,
  attemptId: string,
  index: number,
): Promise<WorkingPaper> {
  await waitForSession(owner, attemptId);
  if (await records.read(owner, "attempt-deleted", attemptId))
    throw Error("This session was deleted.");
  return validateWorkingPaper(
    (await records.read(owner, workingKind(attemptId), String(index))) ||
      emptyWorkingPaper(),
  );
}
export function saveWorkingPaper(
  owner: string,
  attemptId: string,
  index: number,
  value: WorkingPaper,
) {
  const snapshot = JSON.parse(
    JSON.stringify(validateWorkingPaper(value)),
  ) as WorkingPaper;
  return withSession(owner, attemptId, async () => {
    if (await records.read(owner, "attempt-deleted", attemptId))
      throw Error("This session was deleted.");
    const attempt = await records.read<AttemptHeader>(
      owner,
      "attempt",
      attemptId,
    );
    if (
      !attempt ||
      attempt.status !== "active" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= attempt.questionCount
    )
      throw Error(
        "Working can only be saved to a question in an unfinished session.",
      );
    if (snapshot.strokes.length)
      await records.write(
        owner,
        workingKind(attemptId),
        String(index),
        snapshot,
      );
    else await records.remove(owner, workingKind(attemptId), String(index));
  });
}
