import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { configureManifest } = require("../plugins/withOptionalHardware.cjs");

test("camera permission cannot imply mandatory Chromebook hardware after prebuild", () => {
  const manifest: any = {
    "uses-permission": [{ $: { "android:name": "android.permission.CAMERA" } }],
    "uses-feature": [
      {
        $: {
          "android:name": "android.hardware.camera",
          "android:required": "true",
        },
      },
      { $: { "android:name": "android.hardware.camera.autofocus" } },
      {
        $: {
          "android:name": "android.hardware.opengles.aep",
          "android:required": "true",
        },
      },
    ],
    application: [
      {
        activity: [
          {
            $: {
              "android:name": ".MainActivity",
              "android:resizeableActivity": "false",
            },
          },
          { $: { "android:name": ".OtherActivity" } },
        ],
      },
    ],
  };
  configureManifest(manifest);
  const encoded = JSON.stringify(manifest);
  configureManifest(manifest);
  assert.equal(
    JSON.stringify(manifest),
    encoded,
    "repeated prebuilds must be idempotent",
  );
  for (const name of [
    "camera",
    "camera.any",
    "camera.front",
    "camera.autofocus",
    "camera.flash",
    "touchscreen",
    "touchscreen.multitouch",
    "touchscreen.multitouch.distinct",
  ]) {
    const matching = manifest["uses-feature"].filter(
      (f: any) => f.$["android:name"] === `android.hardware.${name}`,
    );
    assert.equal(matching.length, 1);
    assert.equal(matching[0].$["android:required"], "false");
  }
  assert.equal(
    manifest["uses-permission"][0].$["android:name"],
    "android.permission.CAMERA",
  );
  assert.equal(
    manifest["uses-feature"].find(
      (f: any) => f.$["android:name"] === "android.hardware.opengles.aep",
    ).$["android:required"],
    "true",
  );
  assert.equal(
    manifest.application[0].activity[0].$["android:resizeableActivity"],
    "true",
  );
  assert.equal(
    manifest.application[0].activity[1].$["android:resizeableActivity"],
    undefined,
  );
});

test("minimal manifests gain optional hardware without requiring any camera or touchscreen", () => {
  const manifest: any = {};
  configureManifest(manifest);
  assert.equal(manifest["uses-feature"].length, 8);
  assert.ok(
    manifest["uses-feature"].every(
      (f: any) => f.$["android:required"] === "false",
    ),
  );
});
