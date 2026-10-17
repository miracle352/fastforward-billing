import { safeDiagnosticSummary } from '../apps/api/src/privacy.ts';
// Run with --env-file=.env. Never enumerate/print environment values or provider responses.
process.stdout.write(JSON.stringify(safeDiagnosticSummary(process.env),null,2)+'\n');
