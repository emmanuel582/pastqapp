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
  console.log(
    "Prepared " + poses.length + " original poses at " + w + "x" + h + ".",
  );
})();
