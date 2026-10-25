const { withAndroidManifest } = require("expo/config-plugins");

const optionalFeatures = [
  "android.hardware.camera",
  "android.hardware.camera.any",
  "android.hardware.camera.front",
  "android.hardware.camera.autofocus",
  "android.hardware.camera.flash",
  "android.hardware.touchscreen",
  "android.hardware.touchscreen.multitouch",
  "android.hardware.touchscreen.multitouch.distinct",
];

function configureManifest(manifest) {
  // CAMERA permission otherwise makes Play infer a required rear camera/autofocus.
  const features = (manifest["uses-feature"] ??= []);
  for (const name of optionalFeatures) {
    const existing = features.filter(
      (feature) => feature.$?.["android:name"] === name,
    );
    if (!existing.length) {
      features.push({
        $: { "android:name": name, "android:required": "false" },
      });
    } else {
      for (const feature of existing) feature.$["android:required"] = "false";
    }
  }
  for (const application of manifest.application ?? []) {
    for (const activity of application.activity ?? []) {
      if (activity.$?.["android:name"] === ".MainActivity") {
        activity.$["android:resizeableActivity"] = "true";
      }
    }
  }
  return manifest;
}

module.exports = function withOptionalHardware(config) {
  return withAndroidManifest(config, (mod) => {
    configureManifest(mod.modResults.manifest);
    return mod;
  });
};
module.exports.configureManifest = configureManifest;
