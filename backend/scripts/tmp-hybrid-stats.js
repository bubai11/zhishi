const fs = require('fs');

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  values.push(current);
  return values;
}

function hasChinese(text) {
  return /[\u3400-\u9FFF]/.test(String(text || ''));
}

const filePath = 'data/cn-review-hybrid.csv';
const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
const header = parseCsvLine(lines[0]);
const index = (name) => header.indexOf(name);

let approved = 0;
let approvedApply = 0;
let approvedApplyZh = 0;

for (let i = 1; i < lines.length; i += 1) {
  const cols = parseCsvLine(lines[i]);
  const status = String(cols[index('review_status')] || '').trim().toUpperCase();
  const apply = String(cols[index('apply_to_pending')] || '').trim().toUpperCase();
  const chineseName = String(cols[index('chinese_name')] || '').trim();

  if (status === 'APPROVED') approved += 1;
  if (status === 'APPROVED' && ['Y', 'YES', 'TRUE', '1'].includes(apply)) {
    approvedApply += 1;
    if (hasChinese(chineseName)) approvedApplyZh += 1;
  }
}

console.log({ rows: lines.length - 1, approved, approvedApply, approvedApplyZh });
