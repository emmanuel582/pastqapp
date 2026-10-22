const fs = require("fs"),
  path = require("path");
const dir = path.dirname(require.resolve("katex/package.json"));
let css = fs.readFileSync(path.join(dir, "dist/katex.min.css"), "utf8");
css = css.replace(/src:[^;}]+/g, (match) => {
  const file = match.match(/url\(([^)]+\.woff2)\)/);
  return file
    ? "src:url(data:font/woff2;base64," +
        fs.readFileSync(path.join(dir, "dist", file[1])).toString("base64") +
        ') format("woff2")'
    : match;
});
const font = (family, file) =>
  "@font-face{font-family:" +
  family +
  ";src:url(data:font/ttf;base64," +
  fs.readFileSync(file).toString("base64") +
  ")}";
css +=
  font(
    "Lora",
    "node_modules/@expo-google-fonts/lora/400Regular/Lora_400Regular.ttf",
  ) +
  font(
    "Manrope",
    "node_modules/@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf",
  );
fs.writeFileSync(
  "src/data/mathCss.ts",
  "export const mathCss=" + JSON.stringify(css) + ";\n",
);
console.log("Bundled offline math and exact question fonts.");
