const fs = require("fs"),
  path = require("path"),
  sharp = require("sharp");
(async () => {
  const atlas = "assets/scholar/spritesheet.webp";
  const meta = await sharp(atlas).metadata();
  const w = meta.width / 8,
    h = meta.height / 11;
  fs.mkdirSync("assets/scholar/frames", { recursive: true });
  const poses = [];
  for (const [row, frames] of [
    [0, [0, 2, 3, 4]],
    [3, [0, 1, 2, 3]],
    [5, [4, 5, 6]],
    [6, [0, 2, 3, 4, 5]],
    [7, [0, 2, 3, 4, 5]],
    [8, [0, 1, 3, 5]],
  ])
    for (const frame of frames) {
      const name = row + "-" + frame;
      await sharp(atlas)
        .extract({
          left: Math.round(frame * w),
          top: Math.round(row * h),
          width: Math.round(w),
          height: Math.round(h),
        })
        .webp({ lossless: true })
        .toFile("assets/scholar/frames/" + name + ".webp");
      poses.push(
        "  '" +
          name +
          "':require('../../assets/scholar/frames/" +
          name +
          ".webp')",
      );
    }
  fs.writeFileSync(
    "src/data/poses.ts",
    "export const poses:Record<string,number>={\n" +
      poses.join(",\n") +
      "\n};\n",
  );
  const image = (file) =>
    "data:image/" + (file.endsWith(".webp") ? "webp" : "png") + ";base64," +
    fs.readFileSync("assets/scholar/" + file).toString("base64");
  const field =
    '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="208"><defs><linearGradient id="bend" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(100%,50%,50%)"/><stop offset=".55" stop-color="rgb(100%,50%,50%)"/><stop offset="1" stop-color="rgb(50%,50%,50%)"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation="1.1"/></filter></defs><rect width="192" height="208" fill="rgb(50%,50%,50%)"/><rect x="48" y="18" width="34" height="64" fill="url(#bend)" filter="url(#soft)"/></svg>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="42 0 108 208" style="display:block;width:100%;height:100%;overflow:visible"><defs><filter id="wave" filterUnits="userSpaceOnUse" x="38" y="0" width="116" height="208" color-interpolation-filters="sRGB"><feImage href="data:image/svg+xml,${encodeURIComponent(field)}" x="0" y="0" width="192" height="208" result="wave-field"/><feDisplacementMap in="SourceGraphic" in2="wave-field" scale="0" xChannelSelector="R" yChannelSelector="G"><animate attributeName="scale" values="0;7;0;-7;0" dur="2.8s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.25;.5;.75;1" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1"/></feDisplacementMap></filter><filter id="feather" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation=".45"/></filter><mask id="eyes" maskUnits="userSpaceOnUse" x="82" y="20" width="33" height="17"><g fill="white" filter="url(#feather)"><ellipse cx="92.3" cy="27.8" rx="6.5" ry="4.4"/><ellipse cx="105.2" cy="27.8" rx="6.5" ry="4.4"/></g></mask></defs><image href="${image("wave-clean-v2.webp")}" width="192" height="208" filter="url(#wave)"/></svg>`;
  const html =
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}.blink{opacity:0;animation:blink 4.8s -2s linear infinite}@keyframes blink{0%,91%,96%,100%{opacity:0}92%,94%{opacity:1}}@media(prefers-reduced-motion:reduce){.blink{animation:none}}</style></head><body>' +
    svg +
    "</body></html>";
  fs.writeFileSync(
    "src/data/greeting.ts",
    "// Exact source SVG displacement and blink with bundled original pixels.\nexport const greetingHtml=" +
      JSON.stringify(html) +
      ";\n",
  );
  console.log(
    "Prepared " +
      poses.length +
      " original poses at " +
      w +
      "x" +
      h +
      "; exact greeting filter preserved.",
  );
})();
