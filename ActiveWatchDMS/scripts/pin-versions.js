// scripts/pin-versions.js
// Run from D:\FYP\frontend on the setup that WORKS:
//   node scripts\pin-versions.js            -> exact versions from node_modules (what is installed now)
//   node scripts\pin-versions.js --lock     -> exact versions from package-lock.json (use a lockfile from the good month)
// It (1) rewrites package.json with exact versions (backup: package.json.bak),
//    (2) writes .npmrc (save-exact) and .nvmrc, (3) writes ENVIRONMENT_VERSIONS.md with
//    Node/Java/Gradle/AGP/Kotlin/SDK/NDK/CMake/build-tools details.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const useLock = process.argv.includes('--lock');
const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) { console.error('Run this from the project root (package.json not found).'); process.exit(1); }
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const sh = (c) => { try { return execSync(c, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim(); } catch (e) { return ((e.stderr || e.stdout || '') + '').toString().trim() || 'n/a'; } };
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };

// ---------- 1. exact npm versions ----------
let lock = null;
if (useLock) {
  try { lock = JSON.parse(read(path.join(root, 'package-lock.json'))).packages || {}; } catch {}
  if (!lock) { console.error('package-lock.json missing/unreadable'); process.exit(1); }
}
function installed(name) {
  if (lock) return lock['node_modules/' + name]?.version;
  try { return JSON.parse(read(path.join(root, 'node_modules', name, 'package.json'))).version; } catch { return undefined; }
}
const changes = [], missing = [];
for (const section of ['dependencies', 'devDependencies']) {
  for (const [name, range] of Object.entries(pkg[section] || {})) {
    const v = installed(name);
    if (!v) { missing.push(name); continue; }
    if (range !== v) changes.push(`${name}: ${range} -> ${v}`);
    pkg[section][name] = v;
  }
}
fs.copyFileSync(pkgPath, pkgPath + '.bak');
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(path.join(root, '.npmrc'), 'save-exact=true\n');
const nodeV = process.version.replace(/^v/, '');
fs.writeFileSync(path.join(root, '.nvmrc'), nodeV + '\n');

// ---------- 2. native / SDK info ----------
const A = path.join(root, 'android');
const grab = (file, re) => read(file).split(/\r?\n/).filter((l) => re.test(l)).map((l) => '    ' + l.trim()).join('\n') || '    (not found)';
const rootGradle = path.join(A, 'build.gradle');
const appGradle = path.join(A, 'app', 'build.gradle');
const gradleProps = path.join(A, 'gradle.properties');
const wrapper = path.join(A, 'gradle', 'wrapper', 'gradle-wrapper.properties');
const localProps = read(path.join(A, 'local.properties'));
const sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
  (localProps.match(/sdk\.dir\s*=\s*(.+)/) || [])[1]?.replace(/\\\\/g, '\\').replace(/\\:/g, ':').trim() || 'D:\\Android\\Sdk';
const ls = (sub) => { try { return fs.readdirSync(path.join(sdkDir, sub)).join(', ') || '(empty)'; } catch { return '(folder not found)'; } };

const md = `# Environment versions (generated ${new Date().toISOString().slice(0, 10)})

Source of npm versions: ${useLock ? 'package-lock.json' : 'node_modules (installed)'}

## Tools on this machine
- Node: ${nodeV}   (package.json engines: ${pkg.engines?.node ?? 'n/a'})
- npm: ${sh('npm -v')}
- Java: ${(sh('java -version 2>&1').split(/\r?\n/).find((l) => /version/.test(l)) || 'n/a')}
- JAVA_HOME: ${process.env.JAVA_HOME || 'not set'}
- ANDROID_HOME / sdk.dir: ${sdkDir}

## Android SDK folders installed
- ndk: ${ls('ndk')}
- build-tools: ${ls('build-tools')}
- platforms: ${ls('platforms')}
- cmake: ${ls('cmake')}

## Gradle / Android project settings
Gradle wrapper:
${grab(wrapper, /distributionUrl/)}
android/build.gradle (SDK/NDK/Kotlin/AGP):
${grab(rootGradle, /(buildToolsVersion|minSdk|compileSdk|targetSdk|ndkVersion|kotlinVersion|classpath)/i)}
android/app/build.gradle:
${grab(appGradle, /(ndkVersion|compileSdk|targetSdk|minSdk|abiFilters|applicationId|versionName|versionCode)/i)}
android/gradle.properties:
${grab(gradleProps, /(newArchEnabled|hermesEnabled|reactNativeArchitectures|org\.gradle\.jvmargs|android\.)/i)}

## Pinned npm packages
${[...Object.entries(pkg.dependencies || {}), ...Object.entries(pkg.devDependencies || {})].map(([n, v]) => `- ${n}@${v}`).join('\n')}

## Rebuild recipe
1. Install Node ${nodeV}, the Java above, Android SDK/NDK/CMake versions above.
2. \`npm ci\`   (never \`npm install\` / \`npm update\`)
3. \`cd android; .\\gradlew.bat assembleRelease\`
`;
fs.writeFileSync(path.join(root, 'ENVIRONMENT_VERSIONS.md'), md);

console.log(`Pinned ${changes.length} packages (backup: package.json.bak)`);
changes.forEach((c) => console.log('  ' + c));
if (missing.length) console.log('NOT FOUND (left unchanged): ' + missing.join(', '));
console.log('Wrote ENVIRONMENT_VERSIONS.md, .npmrc, .nvmrc');