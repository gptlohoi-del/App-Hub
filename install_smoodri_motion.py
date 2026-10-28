#!/usr/bin/env python3
"""Persisted native patch installed AFTER `npx cap add android && npx cap sync android`.

Do not edit android/ manually: workflows regenerate it on each build.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / 'android/app/src/main'
SOURCES = ROOT / 'native/smoodri/java'
DEST = ANDROID / 'java/vn/gptlohoi/apphub'
MANIFEST = ANDROID / 'AndroidManifest.xml'

if not MANIFEST.is_file():
    raise SystemExit('ERROR: Run npx cap add android && npx cap sync android first')
DEST.mkdir(parents=True, exist_ok=True)
for name in ('MainActivity.java', 'SmooDriMotionService.java', 'SmooDriMotionPlugin.java'):
    shutil.copy2(SOURCES / name, DEST / name)

content = MANIFEST.read_text(encoding='utf-8')
for name in ('FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_SPECIAL_USE', 'POST_NOTIFICATIONS', 'WAKE_LOCK'):
    declaration = f'<uses-permission android:name="android.permission.{name}" />'
    if declaration not in content:
        content = content.replace('<application', f'{declaration}\n    <application', 1)

service = '''        <service
            android:name=".SmooDriMotionService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="User-initiated continuous driving comfort measurement from accelerometer and linear acceleration sensors; user-visible notification with stop action" />
        </service>
'''
if 'android:name=".SmooDriMotionService"' not in content:
    content = content.replace('</application>', service + '    </application>', 1)
MANIFEST.write_text(content, encoding='utf-8')
print('OK: SmooDriMotionPlugin + Foreground Service installed into generated Android project')
