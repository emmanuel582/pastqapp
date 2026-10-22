import { requireAuth } from "./auth";
export type AttemptForStorage = {
  questionKey: string;
  topicKey: string;
  selectedOptionIndex: number | null;
  isCorrect: boolean | null;
  attemptOrder: number;
  answered?: boolean;
};

/**
 * Stores a student's outcome only. questionKey is an opaque Hostinger-library
 * reference; no question wording, choice, answer, image, or explanation is
 * ever sent to Supabase.
 */
export const savePracticeResult = async (input: {
  id: string;
  completedAt?: string;
  userId: string;
  sourceBundleId: string;
  sourceBundleVersion?: string | null;
  durationSeconds: number;
  score: number;
  attempts: AttemptForStorage[];
}) => {
  const completedAt = input.completedAt || new Date().toISOString();
  const answeredCount = input.attempts.filter(
    (attempt) => attempt.answered ?? attempt.selectedOptionIndex != null,
  ).length;
  const { data: practice, error: practiceError } = await requireAuth()
    .from("practice_sessions")
    .upsert(
      {
        id: input.id,
        user_id: input.userId,
        source_bundle_id: input.sourceBundleId,
        source_bundle_version: input.sourceBundleVersion || null,
        mode: "timed",
        question_count: input.attempts.length,
        answered_count: answeredCount,
        correct_count: input.score,
        duration_seconds: input.durationSeconds,
        status: "completed",
        completed_at: completedAt,
        question_keys: input.attempts.map((attempt) => attempt.questionKey),
      },
      { onConflict: "id" },
    )
    .select("id")
    .single();
  if (practiceError) throw practiceError;

  // The schema's session/question unique key makes retries safe after a crash.
  const { error: attemptsError } = await requireAuth()
    .from("question_attempts")
    .upsert(
      input.attempts.map((attempt) => ({
        user_id: input.userId,
        practice_session_id: practice.id,
        question_key: attempt.questionKey,
        topic_keys: [attempt.topicKey],
        selected_option_index: attempt.selectedOptionIndex,
        is_correct: attempt.isCorrect,
        attempt_order: attempt.attemptOrder,
      })),
      { onConflict: "practice_session_id,question_key" },
    );
  if (attemptsError) throw attemptsError;

  const topicDeltas = new Map<string, { attempts: number; correct: number }>();
  for (const attempt of input.attempts) {
    if (attempt.isCorrect == null) continue;
    const current = topicDeltas.get(attempt.topicKey) || {
      attempts: 0,
      correct: 0,
    };
    current.attempts += 1;
    current.correct += attempt.isCorrect ? 1 : 0;
    topicDeltas.set(attempt.topicKey, current);
  }
  const topicKeys = [...topicDeltas.keys()];
  if (topicKeys.length) {
    const totals = new Map<string, { attempts: number; correct: number }>();
    // Recompute from persisted outcomes rather than incrementing on every retry.
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await requireAuth()
        .from("question_attempts")
        .select("topic_keys,is_correct")
        .eq("user_id", input.userId)
        .order("id")
        .range(offset, offset + 999);
      if (error) throw error;
      for (const row of data || [])
        if (row.is_correct !== null)
          for (const key of row.topic_keys || []) {
            const total = totals.get(key) || { attempts: 0, correct: 0 };
            total.attempts++;
            if (row.is_correct) total.correct++;
            totals.set(key, total);
          }
      if ((data || []).length < 1000) break;
    }
    const now = new Date().toISOString();
    const masteryRows = topicKeys.map((topicKey) => {
      const { attempts, correct } = totals.get(topicKey) || {
        attempts: 0,
        correct: 0,
      };
      return {
        user_id: input.userId,
        topic_key: topicKey,
        attempts,
        correct,
        mastery_score: attempts ? correct / attempts : 0,
        // Confidence rises with evidence but does not pretend a new learner is certain.
        confidence_score: Math.min(0.95, 0.2 + Math.log10(attempts + 1) / 2),
        last_attempt_at: now,
        updated_at: now,
      };
    });
    const { error: masteryError } = await requireAuth()
      .from("student_topic_mastery")
      .upsert(masteryRows, { onConflict: "user_id,topic_key" });
    if (masteryError) throw masteryError;
  }

  const { data: events, error: lookupError } = await requireAuth()
    .from("learning_events")
    .select("id")
    .eq("user_id", input.userId)
    .eq("event_name", "practice_completed")
    .contains("event_data", { practiceSessionId: practice.id })
    .limit(1);
  if (lookupError) throw lookupError;
  if (!events?.length) {
    const { error } = await requireAuth()
      .from("learning_events")
      .insert({
        user_id: input.userId,
        event_name: "practice_completed",
        event_data: {
          practiceSessionId: practice.id,
          sourceBundleId: input.sourceBundleId,
          answeredCount,
        },
      });
    if (error) throw error;
  }

  return practice.id;
};
