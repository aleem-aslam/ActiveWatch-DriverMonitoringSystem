// scripts/patch-settings.js
const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src', 'hooks', 'useSettings.ts');
if (!fs.existsSync(file)) { console.error('Cannot find src\\hooks\\useSettings.ts. Run this from D:\\FYP\\frontend'); process.exit(1); }

let s = fs.readFileSync(file, 'utf8');
if (s.includes('lastRemoteKey')) { console.log('Already patched. Nothing to do.'); process.exit(0); }

const nl = s.includes('\r\n') ? '\r\n' : '\n';
const problems = [];

// 1) a module-level variable next to boundUid
const reBound = /(let\s+boundUid\s*:\s*string\s*\|\s*null\s*=\s*null\s*;)/;
if (reBound.test(s)) s = s.replace(reBound, `$1${nl}let lastRemoteKey: string | null = null; // last saved profile we applied`);
else problems.push('could not find:  let boundUid: string | null = null;');

// 2) remember the key when the account is bound
const reFirst = /(boundUid\s*=\s*uid\s*;)/;
if (reFirst.test(s)) s = s.replace(reFirst, `$1${nl}      lastRemoteKey = remoteKey;`);
else problems.push('could not find:  boundUid = uid;');

// 3) re-apply the profile only when it really changed
const reElse = /\}\s*else\s+if\s*\(\s*uid\s*&&\s*remote\s*\)\s*\{/;
if (reElse.test(s)) s = s.replace(reElse, `} else if (uid && remote && remoteKey !== lastRemoteKey) {${nl}      lastRemoteKey = remoteKey;`);
else problems.push('could not find:  } else if (uid && remote) {');

if (problems.length) {
  console.error('Not patched. ' + problems.join(' | '));
  console.error('Your useSettings.ts is different from what I expected. Send me the file and I will fix it.');
  process.exit(1);
}
fs.copyFileSync(file, file + '.bak');
fs.writeFileSync(file, s);
console.log('Patched src\\hooks\\useSettings.ts (backup: useSettings.ts.bak)');