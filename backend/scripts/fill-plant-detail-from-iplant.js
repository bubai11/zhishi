if (!process.argv.some((arg) => arg.startsWith('--rounds='))) {
  process.argv.push('--rounds=1000000');
}
if (!process.argv.includes('--high-yield-only') && !process.argv.includes('--no-high-yield-only')) {
  process.argv.push('--high-yield-only');
}
if (!process.argv.some((arg) => arg.startsWith('--min-genus-success-rate='))) {
  process.argv.push('--min-genus-success-rate=40');
}
if (!process.argv.some((arg) => arg.startsWith('--min-genus-samples='))) {
  process.argv.push('--min-genus-samples=7');
}
if (!process.argv.some((arg) => arg.startsWith('--min-genus-successes='))) {
  process.argv.push('--min-genus-successes=3');
}

require('./enrich-plants-from-iplant');
