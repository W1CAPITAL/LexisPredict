$ErrorActionPreference = 'Stop'

New-Item -ItemType Directory -Force -Path mobile-air\build\classes,mobile-air\build\native,mobile-air\build\ext,mobile-air\build\icons | Out-Null

$androidJar = Join-Path $env:ANDROID_HOME 'platforms\android-35\android.jar'
if (!(Test-Path $androidJar)) { throw "android-35/android.jar not found" }

Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile((Resolve-Path 'public\logo.png'))
foreach ($size in @(48,72,96,144,192)) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(7,10,18))
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($src, 0, 0, $size, $size)
  $g.Dispose()
  $out = Join-Path (Resolve-Path 'mobile-air\build\icons') ("icon{0}.png" -f $size)
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
$src.Dispose()

compc '-source-path=mobile-air/ane-as/src' '-include-classes=br.davi.lexispredict.mobile.WebMarker' '-output=mobile-air/build/lexisweb.swc'
if ($LASTEXITCODE -ne 0) { throw "compc failed" }

$fre = Join-Path $env:AIR_HOME 'lib\android\FlashRuntimeExtensions.jar'
$javaFiles = Get-ChildItem -Recurse mobile-air\ane-java\src -Filter *.java | ForEach-Object { $_.FullName }
javac -source 8 -target 8 -cp "$fre;$androidJar" -d mobile-air\build\classes $javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

jar cf mobile-air\build\native\lexisweb.jar -C mobile-air\build\classes .

Push-Location mobile-air\build\native
jar xf ..\lexisweb.swc library.swf
Pop-Location

adt -package -target ane mobile-air\build\ext\lexisweb.ane mobile-air\extension.xml -swc mobile-air\build\lexisweb.swc -platform Android-ARM -C mobile-air\build\native lexisweb.jar library.swf -platform Android-ARM64 -C mobile-air\build\native lexisweb.jar library.swf
if ($LASTEXITCODE -ne 0) { throw "ANE packaging failed" }

mxmlc '-source-path=mobile-air/src' '-output=mobile-air/build/LexisMobile.swf' mobile-air/src/LexisMobile.as
if ($LASTEXITCODE -ne 0) { throw "mxmlc failed" }

adt -certificate -cn 'LexisPredict Android AIR' 2048-RSA mobile-air\build\cert.p12 lexispredict
if ($LASTEXITCODE -ne 0) { throw "certificate creation failed" }

adt -package -target apk-captive-runtime -arch armv8 -storetype pkcs12 -keystore mobile-air\build\cert.p12 -storepass lexispredict mobile-air\build\LexisPredict_AIR_ARM64_1.0.0.apk mobile-air\LexisMobile-app.xml -C mobile-air\build LexisMobile.swf icons -extdir mobile-air\build\ext
if ($LASTEXITCODE -ne 0) { throw "APK packaging failed" }

$entries = jar tf mobile-air\build\LexisPredict_AIR_ARM64_1.0.0.apk
if (!($entries | Select-String 'lib/arm64-v8a/')) { throw "APK missing ARM64 runtime" }

Write-Host "APK ready: mobile-air/build/LexisPredict_AIR_ARM64_1.0.0.apk"
