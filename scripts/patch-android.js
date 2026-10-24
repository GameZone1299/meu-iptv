// Ajusta o AndroidManifest para funcionar também na Android TV (Leanback)
const fs = require("fs");
const p = "android/app/src/main/AndroidManifest.xml";
let x = fs.readFileSync(p, "utf8");

if (!x.includes("android.software.leanback")) {
  x = x.replace(
    "<application",
    `<uses-feature android:name="android.software.leanback" android:required="false" />
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />
    <application`
  );
}
if (!x.includes("LEANBACK_LAUNCHER")) {
  x = x.replace(
    '<category android:name="android.intent.category.LAUNCHER" />',
    `<category android:name="android.intent.category.LAUNCHER" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />`
  );
}
if (!x.includes("usesCleartextTraffic")) {
  x = x.replace("<application", '<application android:usesCleartextTraffic="true"');
}
fs.writeFileSync(p, x);
console.log("AndroidManifest ajustado (celular + Android TV).");
