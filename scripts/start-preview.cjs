const fs = require("fs"),
  os = require("os"),
  path = require("path"),
  { spawn } = require("child_process");
async function main() {
  const addresses = Object.entries(os.networkInterfaces()).flatMap(
    ([name, rows]) =>
      (rows || [])
        .filter(
          (r) =>
            r.family === "IPv4" &&
            !r.internal &&
            !r.address.startsWith("169.254."),
        )
        .map((r) => ({ name, ip: r.address })),
  );
  const picked =
    addresses.find((r) => /wi-fi|wifi|wlan/i.test(r.name)) ||
    addresses.find(
      (r) => /ethernet/i.test(r.name) && !r.ip.startsWith("192.168.137."),
    );
  if (!picked)
    throw Error(
      "Connect the laptop to Wi-Fi before starting the iPhone preview.",
    );
  const url = "exp://" + picked.ip + ":8081";
  const bits = require("toqr").toQR(url),
    size = Math.sqrt(bits.length),
    scale = 12,
    quiet = 4;
  let cells = "";
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (bits[y * size + x])
        cells +=
          '<rect x="' +
          (x + quiet) +
          '" y="' +
          (y + quiet) +
          '" width="1" height="1"/>';
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    (size + quiet * 2) * scale +
    '" height="' +
    (size + quiet * 2) * scale +
    '" viewBox="0 0 ' +
    (size + quiet * 2) +
    " " +
    (size + quiet * 2) +
    '"><rect width="100%" height="100%" fill="white"/><g fill="black">' +
    cells +
    "</g></svg>";
  fs.mkdirSync("docs", { recursive: true });
  await require("sharp")(Buffer.from(svg))
    .png()
    .toFile("docs/iphone-preview-qr.png");
  fs.writeFileSync(
    "docs/preview-connection.json",
    JSON.stringify(
      { url, network: picked.name, generatedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(
    "Connect your iPhone to the same Wi-Fi. Scan docs/iphone-preview-qr.png with the iPhone Camera.",
  );
  console.log(url);
  const expo = path.join(
    path.dirname(require.resolve("expo/package.json")),
    "bin",
    "cli",
  );
  const child = spawn(
    process.execPath,
    [expo, "start", "--go", "--lan", "--port", "8081"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        REACT_NATIVE_PACKAGER_HOSTNAME: picked.ip,
        EXPO_PUBLIC_DESIGN_PREVIEW: "false",
      },
    },
  );
  child.on("exit", (code) => {
    process.exitCode = code || 0;
  });
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
