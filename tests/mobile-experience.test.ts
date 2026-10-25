import test from "node:test";
import assert from "node:assert/strict";
import {
  horizontalQuestionIntent,
  questionSwipeDirection,
  adjacentQuestion,
} from "../src/domain/swipe";
import {
  buildReminderPlan,
  localStudyDay,
  notificationDestination,
} from "../src/domain/notifications";
import { reminderDefaults } from "../src/domain/reminders";

test("question swipes preserve taps, vertical reading, diagonal drags and multi-touch", () => {
  assert.equal(horizontalQuestionIntent(10, 0), false);
  assert.equal(horizontalQuestionIntent(22, 60), false);
  assert.equal(horizontalQuestionIntent(45, 40), false);
  assert.equal(horizontalQuestionIntent(90, 2, 2), false);
  assert.equal(questionSwipeDirection(-92, 8, -0.2), 1);
  assert.equal(questionSwipeDirection(90, 8, 0.2), -1);
  assert.equal(questionSwipeDirection(-42, 4, -0.6), 1);
  assert.equal(questionSwipeDirection(-42, 4, -0.1), null);
});
test("question navigation crosses subjects in visible order without wrapping or submitting", () => {
  const visible = [0, 1, 4, 8];
  assert.equal(adjacentQuestion(visible, 1, 1), 4);
  assert.equal(adjacentQuestion(visible, 4, -1), 1);
  assert.equal(adjacentQuestion(visible, 0, -1), null);
  assert.equal(adjacentQuestion(visible, 8, 1), null);
  assert.equal(adjacentQuestion(visible, 5, 1), null);
});
test("reminders use selected days, skip completed days and pause dates, and stay below device limits", () => {
  const now = new Date(2026, 9, 23, 9),
    today = localStudyDay(now);
  const settings = {
    ...reminderDefaults,
    enabled: true,
    mode: "scheduled" as const,
    time: "18:00",
  };
  const all = buildReminderPlan(settings, undefined, [], now);
  assert.equal(all.length, 28);
  assert.equal(all[0].date.getHours(), 18);
  assert.equal(buildReminderPlan(settings, undefined, [today], now).length, 27);
  const paused = buildReminderPlan(
    {
      ...settings,
      days: [1, 3],
      pausedUntil: new Date(2026, 9, 28, 0).toISOString(),
    },
    undefined,
    [],
    now,
  );
  assert.ok(paused.length > 0);
  assert.ok(
    paused.every(
      (item) =>
        [1, 3].includes(item.date.getDay()) &&
        item.date >= new Date(2026, 9, 28, 0),
    ),
  );
  assert.throws(
    () => buildReminderPlan({ ...settings, days: [] }, undefined, [], now),
    /day/,
  );
  assert.throws(
    () => buildReminderPlan({ ...settings, time: "23:00" }, undefined, [], now),
    /quiet/,
  );
  assert.equal(
    buildReminderPlan(
      { ...settings, enabled: false, time: "bad" },
      undefined,
      [],
      now,
    ).length,
    0,
  );
});
test("smart reminders retain preview time while generic reminders do not expose personalized copy", () => {
  const settings = { ...reminderDefaults, enabled: true, personalized: false };
  const plan = buildReminderPlan(
    settings,
    {
      title: "Private performance",
      body: "Private score",
      targetTime: "16:30",
    },
    [],
    new Date(2026, 9, 23, 9),
  );
  assert.equal(plan[0].date.getHours(), 16);
  assert.equal(plan[0].date.getMinutes(), 30);
  assert.doesNotMatch(plan[0].title + plan[0].body, /Private/);
});
test("notification taps only open owned, whitelisted app destinations", () => {
  assert.deepEqual(
    notificationDestination(
      { kind: "study-reminder", owner: "alice" },
      "alice",
    ),
    { screen: "Main", tab: "library" },
  );
  assert.equal(
    notificationDestination({ kind: "study-reminder", owner: "alice" }, "bob"),
    null,
  );
  assert.equal(
    notificationDestination(
      { kind: "study-reminder", owner: "guest" },
      "guest",
    ),
    null,
  );
  assert.equal(
    notificationDestination(
      { owner: "alice", url: "https://example.com" },
      "alice",
    ),
    null,
  );
  assert.equal(
    notificationDestination(
      { owner: "alice", kind: "material-ready", sessionId: "../private" },
      "alice",
    ),
    null,
  );
  assert.deepEqual(
    notificationDestination(
      { owner: "alice", kind: "material-ready", sessionId: "session-123" },
      "alice",
    ),
    { screen: "Processing", sessionId: "session-123" },
  );
});

import { processingFollowUp } from "../src/domain/processing";
test("service failures never ask students to replace a photo or expose provider authentication errors", () => {
  const paused = processingFollowUp({
    id: "f",
    type: "paused",
    status: "open",
    message: "OpenRouter 401: User not found",
  });
  assert.equal(paused.photo, false);
  assert.equal(paused.canSkip, false);
  assert.doesNotMatch(paused.message, /OpenRouter|401/);
  assert.equal(
    processingFollowUp({
      id: "f",
      type: "missing_page",
      status: "open",
      message: "Missing page",
    }).photo,
    true,
  );
  assert.equal(
    processingFollowUp({
      id: "f",
      type: "answers_unmatched",
      status: "open",
      message: "Check supplied answers",
    }).photo,
    false,
  );
});
