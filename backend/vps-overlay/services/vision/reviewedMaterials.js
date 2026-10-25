/** Reviewed uploads stay private to their extraction owner, outside the shared catalog. */
const choiceTypes = new Set(["single_choice", "multiple_choice", "true_false"]);
const writtenTypes = new Set([
  "short_answer",
  "long_answer",
  "theory",
  "essay",
  "structured",
  "fill_blank",
]);
const escape = (value) =>
  String(value || "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
/** Changed text replaces stale rich wording; exact source raster diagrams survive. */
export function reconcileRichText(text, previousText, previousHtml) {
  if (String(text || "").trim() === String(previousText || "").trim())
    return previousHtml;
  if (!previousHtml) return undefined;
  const images = String(previousHtml).match(/<img\b[^>]*>/gi) || [];
  return `<p>${escape(text).replace(/\n/g, "<br>")}</p>${images.join("")}`;
}
export function reviewedMaterial(session, { summary = false } = {}) {
  return {
    id: session.id,
    sourceSessionId: session.id,
    title: session.name,
    name: session.name,
    icon: session.icon,
    approvedAt: session.approvedAt,
    updatedAt: session.updatedAt,
    question_count: session.questions.length,
    groups: session.groups || [],
    ...(summary ? {} : { questions: session.questions }),
  };
}

export function reviewQuestions(session, incoming) {
  if (!["completed", "completed_with_errors"].includes(session.status)) {
    throw Object.assign(
      new Error("Wait for extraction to finish before saving."),
      { status: 409 },
    );
  }
  if ((session.followUps || []).some((f) => f.status === "open"))
    throw Object.assign(
      new Error("Resolve the upload checks before completing."),
      { status: 409 },
    );
  if (
    !Array.isArray(incoming) ||
    !incoming.length ||
    incoming.length > session.questions.length
  ) {
    throw Object.assign(new Error("Keep at least one extracted question."), {
      status: 400,
    });
  }
  const original = new Map(
    session.questions.map((question) => [String(question.id), question]),
  );
  const seen = new Set();
  return incoming.map((edit, index) => {
    const id = String(edit?.id);
    const source = original.get(id);
    const fail = (message = "check the text, options and answer key") => {
      throw Object.assign(
        new Error("Question " + (index + 1) + ": " + message + "."),
        { status: 400 },
      );
    };
    if (!source || seen.has(id)) fail();
    seen.add(id);
    if (
      typeof edit.question !== "string" ||
      !edit.question.trim() ||
      edit.question.length > 50000
    )
      fail();
    const type =
      edit.type ||
      source.type ||
      (edit.options?.length >= 2 ? "single_choice" : "other");
    if (!writtenTypes.has(type) && !choiceTypes.has(type))
      fail("choose CBT or written answer");
    const written = writtenTypes.has(type);
    const minimumOptions = written ? 0 : 2;
    if (
      !Array.isArray(edit.options) ||
      edit.options.length < minimumOptions ||
      edit.options.length > 12 ||
      edit.options.some(
        (option) =>
          typeof option !== "string" || !option.trim() || option.length > 20000,
      )
    )
      fail();
    if (
      edit.correct != null &&
      (!Number.isInteger(edit.correct) ||
        edit.correct < 0 ||
        edit.correct >= edit.options.length)
    )
      fail();
    for (const field of [
      "subject",
      "year",
      "explanation",
      "topic",
      "answerText",
    ]) {
      if (
        field === "year" &&
        Number.isInteger(edit.year) &&
        edit.year >= 1900 &&
        edit.year <= 2200
      )
        continue;
      if (
        edit[field] != null &&
        (typeof edit[field] !== "string" ||
          edit[field].length >
            (["explanation", "answerText"].includes(field) ? 50000 : 300))
      )
        fail();
    }
    const options = edit.options.map((option) => option.trim());
    const optionsHtml = options.map((option, index) => {
      const matching = source.options.findIndex(
        (value) => value.trim() === option,
      );
      const oldIndex = matching >= 0 ? matching : index;
      return (
        reconcileRichText(
          option,
          source.options[oldIndex],
          source.optionsHtml?.[oldIndex],
        ) || ""
      );
    });
    const explanation = edit.explanation ?? source.explanation;
    const unknownKey = !written && edit.correct == null;
    if (written && edit.correct != null) fail();
    // Source figures/provenance remain trusted. Browser HTML and paths are ignored.
    return {
      ...source,
      type,
      question: edit.question.trim(),
      options,
      questionHtml: reconcileRichText(
        edit.question,
        source.question,
        source.questionHtml,
      ),
      optionsHtml,
      explanationHtml: reconcileRichText(
        explanation,
        source.explanation,
        source.explanationHtml,
      ),
      ...(written
        ? {
            answerText: edit.answerText ?? source.answerText,
            answerHtml: reconcileRichText(
              edit.answerText ?? source.answerText,
              source.answerText,
              source.answerHtml,
            ),
          }
        : {}),
      ...(!written &&
      (source.correct !== edit.correct ||
        (edit.correct != null &&
          source.options[edit.correct] !== options[edit.correct]))
        ? {
            answerText: edit.correct == null ? null : options[edit.correct],
            answerHtml: edit.correct == null ? "" : optionsHtml[edit.correct],
          }
        : {}),
      correct: edit.correct ?? null,
      correctLetter:
        edit.correct == null ? null : String.fromCharCode(65 + edit.correct),
      subject: edit.subject?.trim() || source.subject || "General",
      year: edit.year ?? source.year,
      topic: edit.topic ?? source.topic,
      explanation,
      incomplete: false,
      needsReview: unknownKey,
      reviewReasons: unknownKey ? ["Answer key unavailable"] : [],
      qualityFlags: source.qualityFlags || [],
      answerSource: "student_review",
    };
  });
}
