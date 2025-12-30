const fs = require('fs');
const path = require('path');

const covPath = path.join(__dirname, '..', 'coverage', 'coverage-final.json');
if (!fs.existsSync(covPath)) {
  console.error('coverage-final.json not found');
  process.exit(2);
}

const cov = JSON.parse(fs.readFileSync(covPath, 'utf8'));
for (const file in cov) {
  const entry = cov[file];
  if (!entry.b) continue;
  console.log('File:', entry.path);
  let idx = 1;
  for (const bid in entry.b) {
    const counts = entry.b[bid];
    if (Array.isArray(counts)) {
      const [t,f] = counts;
      if (t === 0 || f === 0) {
        const bm = entry.branchMap && entry.branchMap[bid];
        let locInfo = '';
        if (bm && bm.locations) {
          const loc1 = bm.locations[0] && bm.locations[0].start;
          const loc2 = bm.locations[1] && bm.locations[1].start;
          locInfo = ` (loc1: line ${loc1 ? loc1.line : '?'} , loc2: line ${loc2 ? loc2.line : '?' } type ${bm.type})`;
        }
        console.log(`  Branch ${bid}: true=${t} false=${f}${locInfo}`);
      }
    }
    idx++;
  }
}

console.log('Done');

