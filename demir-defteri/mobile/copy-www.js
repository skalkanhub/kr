// ../site klasörünü www/ içine kopyalar (Capacitor webDir). Klipler (mp4) ve araçlar paket dışında kalır.
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'site'), dst = path.join(__dirname, 'www');
fs.rmSync(dst, { recursive: true, force: true });
const skip = new Set(['tools', 'supabase', 'README.md']);
function copy(s, d){ for (const name of fs.readdirSync(s)){ if (skip.has(name)) continue; const a = path.join(s, name), b = path.join(d, name); const st = fs.statSync(a); if (st.isDirectory()){ fs.mkdirSync(b, { recursive: true }); copy(a, b); } else if (!/\.mp4$/i.test(name)){ fs.mkdirSync(d, { recursive: true }); fs.copyFileSync(a, b); } } }
copy(src, dst);
console.log('www hazır:', dst);
