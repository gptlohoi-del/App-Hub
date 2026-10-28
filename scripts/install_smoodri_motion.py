#!/usr/bin/env python3
"""Install native SmooDri FGS + PiP in generated Capacitor Android app.
Run AFTER `npx cap add android && npx cap sync android`.
The generated android/ folder is not used as a source-of-truth.
"""
from pathlib import Path
import re
import shutil
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'android/app/src/main'
SRC = ROOT / 'native/smoodri/java'
manifest = BASE / 'AndroidManifest.xml'
if not manifest.is_file():
    raise SystemExit('ERROR: Android project not generated; run cap add/sync first')

original_activities = list((BASE / 'java').rglob('MainActivity.java'))
if len(original_activities) != 1:
    raise SystemExit(f'ERROR: expected one generated MainActivity, found {len(original_activities)}')
main = original_activities[0]
original = main.read_text(encoding='utf-8')
m = re.search(r'\bpackage\s+([\w.]+)\s*;', original)
if not m or m.group(1) != 'vn.gptlohoi.apphub' or 'BridgeActivity' not in original:
    raise SystemExit('ERROR: MainActivity does not match expected App Hub package/Capacitor setup')
if 'registerPlugin(' in original:
    raise SystemExit('ERROR: MainActivity has pre-existing native registration; merge by hand before replacing')
for name in ('MainActivity.java', 'SmooDriMotionService.java',
             'SmooDriMotionPlugin.java', 'AppHubPiPPlugin.java'):
    shutil.copy2(SRC / name, main.parent / name)

NS = '{http://schemas.android.com/apk/res/android}'
ET.register_namespace('android', 'http://schemas.android.com/apk/res/android')
tree = ET.parse(manifest)
root = tree.getroot()
application = root.find('application')
if application is None:
    raise SystemExit('ERROR: AndroidManifest has no application')
for permission in ('FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_SPECIAL_USE', 'POST_NOTIFICATIONS', 'WAKE_LOCK'):
    name = 'android.permission.' + permission
    if not any(p.get(NS+'name') == name for p in root.findall('uses-permission')):
        ET.SubElement(root, 'uses-permission', {NS+'name': name})
activities = [a for a in application.findall('activity') if
              a.get(NS+'name', '').endswith('MainActivity')]
if len(activities) != 1:
    raise SystemExit('ERROR: AndroidManifest MainActivity not unique')
a = activities[0]
a.set(NS+'supportsPictureInPicture','true')
a.set(NS+'resizeableActivity','true')
existing = a.get(NS+'configChanges', '')
flags = [x for x in existing.split('|') if x]
for flag in ('orientation','screenLayout','screenSize','smallestScreenSize'):
    if flag not in flags: flags.append(flag)
a.set(NS+'configChanges','|'.join(flags))

if not any(x.get(NS+'name') == '.SmooDriMotionService' for x in application.findall('service')):
    service = ET.SubElement(application,'service',{
        NS+'name': '.SmooDriMotionService',
        NS+'exported':'false',
        NS+'foregroundServiceType':'specialUse'
    })
    ET.SubElement(service,'property',{
        NS+'name':'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
        NS+'value':'User-initiated continuous accelerometer measurement of driving comfort; visible notification with stop action'
    })
tree.write(manifest, encoding='utf-8', xml_declaration=True)
print('OK: Installed foreground sensor service, PiP bridge, Android Manifest and both Capacitor plugins.')
