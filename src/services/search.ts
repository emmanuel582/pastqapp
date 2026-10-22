import { supportsIndex, searchIndex } from "../storage/bank";
import * as records from "../storage/records";
import { matchesQuestion, type QuestionMatch } from "../domain/search";
import type { Bundle } from "../domain/types";
export async function searchSavedQuestions(
  owner: string,
  bundles: Bundle[],
  query: string,
  limit = 40,
) {
  const matches: QuestionMatch[] = [];
  if (query.trim().length < 2) return matches;
  for (const meta of bundles) {
    if (matches.length >= limit) break;
    const local = await records.read<Bundle>(owner, "bundle", meta.id);
    const questions =
      meta.indexed && supportsIndex
        ? await searchIndex(owner, meta, query, limit - matches.length)
        : (local?.questions || [])
            .filter((q) => matchesQuestion(q, query))
            .slice(0, limit - matches.length);
    for (const question of questions)
      matches.push({ bundleId: meta.id, title: meta.title, question });
  }
  return matches;
}
