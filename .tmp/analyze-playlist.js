const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'www', 'assets', 'live-playlists', process.argv[2]);
const text = fs.readFileSync(file, 'utf8');
let current = null;
let entries = 0;
const groups = new Map();
const protocols = new Map();
const ext = new Map();
const sample = [];
for (const raw of text.split(/\r?\n/)) {
  const line = raw.trim();
  if (line.startsWith('#EXTINF')) {
    entries++;
    const group = (line.match(/group-title="([^"]*)"/i) || [,''])[1];
    const comma = line.indexOf(',');
    const title = (line.match(/tvg-name="([^"]*)"/i) || [,''])[1] || (comma >= 0 ? line.slice(comma + 1) : '');
    current = { group, title };
  } else if (line && !line.startsWith('#') && current) {
    const key = current.group || '(no group)';
    groups.set(key, (groups.get(key) || 0) + 1);
    const proto = (line.match(/^([a-z]+):/i) || [,'other'])[1].toLowerCase();
    protocols.set(proto, (protocols.get(proto) || 0) + 1);
    const suffix = (line.match(/\.([a-z0-9]+)(?:[?#]|$)/i) || [,'none'])[1].toLowerCase();
    ext.set(suffix, (ext.get(suffix) || 0) + 1);
    if (sample.length < 12) sample.push({ group: current.group, title: current.title, proto, suffix });
    current = null;
  }
}
console.log(JSON.stringify({ file: path.basename(file), entries, groups: [...groups].sort((a,b)=>b[1]-a[1]).slice(0,30), protocols: [...protocols], extensions: [...ext], sample }, null, 2));
