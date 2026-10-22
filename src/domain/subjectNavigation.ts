/** Keep global answer identities while displaying question numbers within a subject. */
export function subjectQuestionGroups(
  questions: { subject: string }[],
): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  questions.forEach((question, index) => {
    if (!groups.has(question.subject)) groups.set(question.subject, []);
    groups.get(question.subject)!.push(index);
  });
  return groups;
}
export function subjectQuestionPosition(
  indexes: number[],
  current: number,
): number {
  return indexes.indexOf(current) + 1;
}
export function subjectAnsweredCount(
  indexes: number[],
  answers: (number | null)[],
  written: string[] = [],
): number {
  return indexes.filter(
    (index) => answers[index] != null || !!written[index]?.trim(),
  ).length;
}
