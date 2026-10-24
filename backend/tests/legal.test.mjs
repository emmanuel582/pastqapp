import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  legalPage,
  legalContent,
  legalPages,
} from "../vps-overlay/public/legal.js";
test("policy pages and deletion request are public, branded, readable without login and contain no executable scripts", () => {
  assert.equal(legalContent.supportEmail, "wealthconsort@gmail.com");
  for (const name of ["privacy", "terms", "delete-account", "support"]) {
    const html = legalPage(name);
    assert.match(html, /focal/);
    assert.match(html, /wealthconsort@gmail.com/);
    assert.doesNotMatch(html, /<script|password=/i);
  }
  assert.match(
    legalPage("delete-account"),
    /mailto:wealthconsort@gmail.com\?subject=focalPoint%20account%20deletion/,
  );
  assert.equal(legalPage("bad"), null);
  assert.deepEqual(
    JSON.parse(fs.readFileSync("legal/content.json", "utf8")),
    legalContent,
  );
});
test("policy middleware does not intercept app API routes and sets restrictive HTML headers", () => {
  let next = 0;
  legalPages({ path: "/api/health" }, {}, () => next++);
  assert.equal(next, 1);
  let headers;
  let sent;
  legalPages(
    { path: "/legal/privacy" },
    { set: (h) => (headers = h), type: () => ({ send: (s) => (sent = s) }) },
    () => {
      throw Error("unexpected fallthrough");
    },
  );
  assert.match(headers["Content-Security-Policy"], /default-src 'none'/);
  assert.match(sent, /Privacy policy/);
});
