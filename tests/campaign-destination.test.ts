import test from "node:test";
import assert from "node:assert/strict";
import { campaignDestination } from "../src/domain/notifications";
test("admin message buttons open their selected native destination", () => {
  assert.deepEqual(campaignDestination("/"), { screen: "Main", tab: "home" });
  assert.deepEqual(campaignDestination("/library"), {
    screen: "Main",
    tab: "library",
  });
  assert.deepEqual(campaignDestination("/profile"), {
    screen: "Main",
    tab: "preferences",
  });
  assert.deepEqual(campaignDestination("/history"), { screen: "History" });
  for (const path of [
    "/?inbox=1",
    "https://other.test",
    "//other.test",
    "/unknown",
  ])
    assert.deepEqual(campaignDestination(path), { screen: "Notifications" });
});
