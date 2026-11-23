# GitHub Actions startup failure

On 2026-11-23, both workflows on [draft PR #1](https://github.com/Nagy-API/TPA-AI-Euro/pull/1) reported the same GitHub check annotation for commit `b91089d9c4b8936cc0b7ddf76229212b983dde55`.

> The job was not started because recent account payments have failed or your spending limit needs to be increased.

| Workflow | Run | Job and check ID |
| --- | --- | --- |
| AI demo tests (no external API) | [45078834326](https://github.com/Nagy-API/TPA-AI-Euro/actions/runs/45078834326) | [137382087960](https://github.com/Nagy-API/TPA-AI-Euro/actions/runs/45078834326/job/137382087960) |
| Docs and fixtures sanity | [45078834399](https://github.com/Nagy-API/TPA-AI-Euro/actions/runs/45078834399) | [137382088177](https://github.com/Nagy-API/TPA-AI-Euro/actions/runs/45078834399/job/137382088177) |

Both job records had `runner_id: 0`, an empty `runner_name`, and `steps: []`. Both job-log endpoints returned HTTP 404. Repository Actions were enabled, all actions were allowed, and default workflow token permissions were read-only. GitHub blocked runner allocation for an account billing or spending-limit reason. The annotation does not identify which condition applies.

Six earlier PR runs and two pushes to `main` also recorded zero runner IDs, zero steps, and the same billing annotation. The [latest failed run on `main`](https://github.com/Nagy-API/TPA-AI-Euro/actions/runs/45072980046) predates the coverage feature.

The account owner can inspect **Settings → Billing & plans** without changing settings or incurring charges. Keep running the checks locally while hosted runners are blocked. When the account owner confirms hosted Actions can run within the approved budget, rerun both jobs and verify their completed results. Until then, hosted CI remains unverified.

## Local checks

Use Node.js 22.16 or later and Python 3.12. The suite includes local HTTP tests that need access to `127.0.0.1`. The tests use synthetic fixtures and in-process stubs for external services.

```sh
npm test
python scripts/validate_repository.py
```

For a strict TypeScript check with TypeScript 5.8.3 and Node 22 declarations available locally, pass all `src/*.ts`, `scripts/*.ts`, and `tests/*.ts` files to `tsc` with `--noEmit --strict --target ES2022 --module NodeNext --allowImportingTsExtensions --types node`. Use `--typeRoots` if the declarations are installed outside the clone.
