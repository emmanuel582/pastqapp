const fs = require("fs"),
  crypto = require("crypto"),
  path = require("path");
const root = process.argv[2] || "C:/Users/DELL/PastQ/client";
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../docs/web-source-sha256.json"),
    "utf8",
  ),
);
const changed = [];
for (const [file, expected] of Object.entries(manifest)) {
  const p = path.join(root, file);
  if (
    !fs.existsSync(p) ||
    crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") !==
      expected
  )
    changed.push(file);
}
if (changed.length) {
  console.log("Files changed since initial snapshot:", changed);
  process.exitCode = 1;
} else
  console.log(
    "All " +
      Object.keys(manifest).length +
      " original web source files match the initial snapshot.",
  );
