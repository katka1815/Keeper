#!/usr/bin/env bash
# Postaví Rozcestnik.apk: tenký androidí obal (okno s Rozcestníkem, sdílení, widget).
# Bez Gradlu, jen nástroje z Android SDK. Spouštět v Git Bash: bash android/build.sh <číslo verze>
# TOOLS = složka s přenosným JDK 17 a Android SDK (platforms/android-34, build-tools/34.0.0).
set -e
HERE="$(cd "$(dirname "$0")" && pwd -W 2>/dev/null || pwd)"
TOOLS="${TOOLS:-C:/Users/42073/android-build}"
OUT="$TOOLS/build-rozcestnik"
export JAVA_HOME="$(ls -d "$TOOLS"/jdk-17* | head -1)"
export PATH="$(cygpath -u "$JAVA_HOME")/bin:$PATH"
BT="$TOOLS/sdk/build-tools/34.0.0"
JAR="$TOOLS/sdk/platforms/android-34/android.jar"
VERSION_CODE=${1:-1}

rm -rf "$OUT" && mkdir -p "$OUT/classes" "$OUT/gen" "$OUT/res"
cp -r "$HERE/res/." "$OUT/res/"
mkdir -p "$OUT/res/mipmap-xxxhdpi"
cp "$HERE/../public/icon-192.png" "$OUT/res/mipmap-xxxhdpi/ic_launcher.png"

"$BT/aapt2.exe" compile --dir "$OUT/res" -o "$OUT/res.zip"
"$BT/aapt2.exe" link -o "$OUT/base.apk" -I "$JAR" --manifest "$HERE/AndroidManifest.xml" --java "$OUT/gen" \
  --min-sdk-version 24 --target-sdk-version 34 --version-code "$VERSION_CODE" --version-name "1.$VERSION_CODE" "$OUT/res.zip"
javac -encoding UTF-8 -nowarn -source 11 -target 11 -cp "$JAR" -d "$OUT/classes" \
  "$HERE"/src/cz/katka/rozcestnik/*.java "$OUT"/gen/cz/katka/rozcestnik/R.java
cmd //c "$(cygpath -w "$BT/d8.bat")" --lib "$JAR" --min-api 24 --output "$OUT" $(find "$OUT/classes" -name "*.class")
python -E -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]+'/base.apk', 'a', zipfile.ZIP_DEFLATED).write(sys.argv[1]+'/classes.dex', 'classes.dex')" "$OUT"
"$BT/zipalign.exe" -f -p 4 "$OUT/base.apk" "$OUT/aligned.apk"

# Podpisový klíč vznikne jednou a leží mimo repozitář; bez něj by nová verze nešla nainstalovat přes starou.
KS="$TOOLS/rozcestnik.keystore"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias rozcestnik -keyalg RSA -keysize 2048 -validity 20000 \
    -storepass rozcestnik-klic -keypass rozcestnik-klic -dname "CN=Rozcestnik"
fi
cmd //c "$(cygpath -w "$BT/apksigner.bat")" sign --ks "$KS" --ks-key-alias rozcestnik \
  --ks-pass pass:rozcestnik-klic --key-pass pass:rozcestnik-klic --out "$TOOLS/Rozcestnik.apk" "$OUT/aligned.apk"
ls -la "$TOOLS/Rozcestnik.apk"
