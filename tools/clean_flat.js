const fs = require('fs');
const path = require('path');

const inPath = path.join(__dirname, '..', 'build', 'flat', 'DEX_flat.sol');
const outPath = path.join(__dirname, '..', 'build', 'flat', 'DEX_flat_clean.sol');
if (!fs.existsSync(inPath)) {
  console.error('Input flattened file not found:', inPath);
  process.exit(1);
}
const src = fs.readFileSync(inPath, 'utf8');
const idx = src.indexOf('pragma solidity');
if (idx === -1) {
  console.error('pragma solidity not found in flattened file');
  process.exit(1);
}
const cleaned = src.slice(idx);
fs.writeFileSync(outPath, cleaned);
console.log('Wrote cleaned flattened file to', outPath);
