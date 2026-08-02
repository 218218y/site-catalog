# TypeScript 7 migration closeout

## Decision

TypeScript 7.0.2 is the only TypeScript compiler and AST contract in the project.
The temporary TypeScript 5.8 compatibility lane has been removed rather than
kept as an implicit lower-bound target.

## Removed compatibility surface

- `typescript-5-8` npm alias and lockfile package.
- TypeScript 5.8 vendored archive.
- TypeScript 5.8 bootstrap and its tests.
- The dual-version matrix runner and all 5.8-specific npm scripts.
- Doctor and verification checks for the retired compiler.

## TypeScript 7 structural analysis

`tools/frontend_ast_inventory.js` now loads:

- `typescript/unstable/sync`
- `typescript/unstable/ast`
- `typescript/unstable/ast/is`

The inventory opens the real `jsconfig.json` project, obtains source files from
the TypeScript 7 program, checks syntactic diagnostics, and then derives import,
export, call, declaration, assignment and property-access facts from the TS7 AST.
The JavaScript contract helper batches project files through this bridge instead
of parsing each file with a second compiler implementation.

## Windows UTF-8 boundary

The Python-to-Node AST bridge explicitly decodes stdout and stderr as UTF-8.
This is required on Windows systems whose process locale is CP1255: JSON emitted
by Node can contain Hebrew source text and must not be decoded using the console
code page. Empty or invalid bridge output is now reported as an infrastructure
failure instead of reaching `json.loads(None)`.

## Gates

- `npm run check:types` provisions and runs only TypeScript 7.0.2.
- `npm run test:js` runs the TypeScript 7 type gate and TS7 AST contracts.
- `npm run doctor` reports one TypeScript compiler: TypeScript 7.
- `tests/typescript_7_compatibility_contract.test.js` prevents restoration of
  the retired package, scripts, bootstrap, archive or matrix runner.
