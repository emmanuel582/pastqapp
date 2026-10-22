import * as Crypto from "expo-crypto";
import * as records from "../storage/records";
import { request, json } from "./api";
import type { QuestionReport } from "../domain/types";
export async function queueReport(
  owner: string,
  input: Omit<QuestionReport, "id" | "owner" | "status" | "createdAt">,
) {
  const report = {
    ...input,
    id: Crypto.randomUUID(),
    owner,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  await records.write(owner, "report", report.id, report);
  return report;
}
export async function syncReports(owner: string) {
  for (const report of await records.list<QuestionReport>(owner, "report"))
    if (report.status === "queued") {
      const { owner: _, ...input } = report;
      const remote = await request<Partial<QuestionReport>>(
        "/api/question-reports",
        json("POST", input),
        true,
      );
      await records.write(owner, "report", report.id, {
        ...report,
        ...remote,
        owner,
      });
    }
  const remote = await request<{ items: QuestionReport[] }>(
    "/api/question-reports",
    {},
    true,
  );
  for (const report of remote.items || [])
    await records.write(owner, "report", report.id, { ...report, owner });
}
