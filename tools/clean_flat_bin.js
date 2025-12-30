const fs = require('fs');
const path = require('path');

const inPath = path.join(__dirname, '..', 'build', 'flat', 'DEX_flat.sol');
const outPath = path.join(__dirname, '..', 'build', 'flat', 'DEX_flat_clean.sol');
if (!fs.existsSync(inPath)) {
  console.error('Input flattened file not found:', inPath);
  process.exit(1);
}
// handle utf16le flattened files produced by some flatteners
const text = fs.readFileSync(inPath, { encoding: 'utf16le' });
const idx = text.indexOf('pragma solidity');
if (idx === -1) {
  console.error('pragma solidity not found in flattened file');
  process.exit(1);
}
const cleaned = text.slice(idx);
fs.writeFileSync(outPath, cleaned, { encoding: 'utf8' });
console.log('Wrote cleaned flattened file to', outPath);
