const fs = require('fs');
const path = require('path');

const kind = process.argv[2] || 'patch';
if (!['major', 'minor', 'patch'].includes(kind)) {
  console.error('Usage: node scripts/bump-version.js major|minor|patch');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const packagePath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');
const versionPath = path.join(root, 'www', 'version.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
let [major, minor, patch] = pkg.version.split('.').map(Number);

if (kind === 'major') { major += 1; minor = 0; patch = 0; }
if (kind === 'minor') { minor += 1; patch = 0; }
if (kind === 'patch') { patch += 1; }

const next = `${major}.${minor}.${patch}`;
pkg.version = next;
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = next;
  if (lock.packages && lock.packages['']) lock.packages[''].version = next;
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}

fs.writeFileSync(versionPath, JSON.stringify({ version: next }, null, 2) + '\n');
console.log(`LifeSim version updated to ${next}`);
