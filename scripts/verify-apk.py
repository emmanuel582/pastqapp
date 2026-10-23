from pathlib import Path
import hashlib
import json
import struct
import sys
import zipfile

apk = Path(sys.argv[1])
raw = apk.read_bytes()
with zipfile.ZipFile(apk) as archive:
    bad = archive.testzip()
    if bad:
        raise ValueError('Corrupt APK entry: ' + bad)
    names = archive.namelist()
    required = ['AndroidManifest.xml', 'classes.dex', 'assets/index.android.bundle']
    for name in required:
        if name not in names:
            raise ValueError('APK missing ' + name)
    abis = sorted({name.split('/')[1] for name in names if name.startswith('lib/') and name.endswith('.so')})
    if 'arm64-v8a' not in abis:
        raise ValueError('APK is missing Android arm64 libraries')
    env_file = apk.parents[1] / '.env'
    config = {}
    if env_file.exists():
        for line in env_file.read_text(encoding='utf-8').splitlines():
            if '=' in line:
                key, value = line.split('=', 1)
                if key in ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_URL']:
                    config[key] = value.strip().strip('\"\'')
    bundle = archive.read('assets/index.android.bundle')
    for key, value in config.items():
        if not value or value.encode() not in bundle:
            raise ValueError('APK is missing its configured ' + key)
    embedded_artwork = sum(1 for name in names if name.startswith(('assets/', 'res/')) and name.endswith(('.ttf', '.png', '.webp', '.jpg')))
end = raw.rfind(b'PK\x05\x06')
if end < 0:
    raise ValueError('APK directory is missing')
central = struct.unpack_from('<I', raw, end + 16)[0]
if raw[central - 16:central] != b'APK Sig Block 42':
    raise ValueError('APK signing block is missing')
size = struct.unpack_from('<Q', raw, central - 24)[0]
start = central - size - 8
if start < 0 or struct.unpack_from('<Q', raw, start)[0] != size:
    raise ValueError('Invalid APK signing block length')
result = {
    'file': str(apk.resolve()), 'bytes': len(raw),
    'sha256': hashlib.sha256(raw).hexdigest(),
    'archiveCrcs': 'passed', 'embeddedBundle': True,
    'configuredApiOriginsEmbedded': len(config),
    'nativeArchitectures': abis, 'embeddedArtAndFontFiles': embedded_artwork,
    'signingBlockPresent': True,
    'limitations': 'Archive and signing-block structure checked; no local cryptographic certificate verification or physical installation performed.'
}
print(json.dumps(result, indent=2))
