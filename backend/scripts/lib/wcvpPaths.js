const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

const CANDIDATE_DIRS = [
  path.join(ROOT, 'data-source', 'wcvp'),
  path.join(ROOT, 'wcvp')
];

function resolveExistingFile(fileName) {
  for (const dir of CANDIDATE_DIRS) {
    const fullPath = path.join(dir, fileName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return path.join(CANDIDATE_DIRS[0], fileName);
}

function getWcvpNamesFile() {
  return resolveExistingFile('wcvp_names.csv');
}

function getWcvpDistributionFile() {
  return resolveExistingFile('wcvp_distribution.csv');
}

module.exports = {
  ROOT,
  getWcvpNamesFile,
  getWcvpDistributionFile
};
