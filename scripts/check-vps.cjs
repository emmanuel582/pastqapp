const fs = require("fs"),
  crypto = require("crypto");
const base = "https://76.13.110.6.nip.io";
(async () => {
  const results = [];
  async function get(path) {
    const t = Date.now(),
      res = await fetch(base + path, { signal: AbortSignal.timeout(30000) });
    return { res, ms: Date.now() - t };
  }
  for (const path of [
    "/api/health",
    "/api/health/ready",
    "/api/library/catalog",
    "/api/library/bundles",
    "/api/discover",
    "/api/vision/materials",
    "/api/reminders/inbox",
    "/api/question-reports",
  ]) {
    const { res, ms } = await get(path);
    const body = await res.json();
    const expected = [
      "/api/discover",
      "/api/vision/materials",
      "/api/reminders/inbox",
      "/api/question-reports",
    ].includes(path)
      ? 401
      : 200;
    if (res.status !== expected)
      throw new Error(
        path + " returned " + res.status + ", expected " + expected,
      );
    results.push({ path, status: res.status, ms });
    if (path === "/api/library/bundles") {
      const smallest = body.bundles.reduce((a, b) =>
        a.question_count < b.question_count ? a : b,
      );
      const { res: manifest } = await get(
        "/api/library/bundles/" + smallest.id + "/manifest",
      );
      if (!manifest.ok) throw new Error("Manifest unavailable");
      const value = await manifest.json();
      if (value.totalQuestions !== value.parts.reduce((n, p) => n + p.count, 0))
        throw new Error("Manifest count mismatch");
      const part = value.parts.reduce((a, b) => (a.bytes < b.bytes ? a : b)),
        { res: download } = await get(
          "/api/library/bundles/" + smallest.id + "/parts/" + part.hash,
        ),
        text = await download.text();
      if (crypto.createHash("sha256").update(text).digest("hex") !== part.hash)
        throw new Error("SHA-256 mismatch");
      const chunk = JSON.parse(text);
      if (chunk.questions.length !== part.count)
        throw new Error("Part count mismatch");
      results.push({
        path: "verified-download-part",
        bundleId: smallest.id,
        questions: part.count,
        bytes: Buffer.byteLength(text),
        sha256: true,
      });
    }
  }
  fs.mkdirSync("docs", { recursive: true });
  fs.writeFileSync(
    "docs/vps-check.json",
    JSON.stringify(
      { checkedAt: new Date().toISOString(), base, results },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
