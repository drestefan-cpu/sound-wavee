// Runs scripts/db-checks.sql against the linked Supabase project and prints a pass/fail list.
// Everything in the SQL is rolled back, so it's safe to run against the live database.
import { execFileSync } from "node:child_process";

let out;
try {
  out = execFileSync("supabase", ["db", "query", "--linked", "-f", "scripts/db-checks.sql"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  console.error("✗ database checks couldn't run:\n" + (err.stdout || "") + (err.stderr || err.message));
  process.exit(1);
}

const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
const rows = JSON.parse(json).rows || [];
let failed = 0;
for (const r of rows) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "✓" : "✗"} ${r.check_name}${!r.ok && r.detail ? `  (${r.detail})` : ""}`);
}
console.log(`\n${rows.length - failed} passed, ${failed} failed`);
process.exit(failed || rows.length === 0 ? 1 : 0);
