// Simple structured logger
export function log(msg) {
  console.log(`[INFO]  ${msg}`);
}

export function ok(msg) {
  console.log(`[OK]    ${msg}`);
}

export function warn(msg) {
  console.warn(`[WARN]  ${msg}`);
}

export function error(msg) {
  console.error(`[ERROR] ${msg}`);
}

export function section(title) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(60)}`);
}
