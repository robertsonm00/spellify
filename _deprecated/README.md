# Deprecated files — hold area

Files here are no longer part of any active phase or plan but are being held for one or two cycles before deletion, in case something downstream still depends on them.

**Before deleting** anything in this folder: run a fresh `grep -r <filename>` across `src/` to confirm nothing imports it, and check git history for the date it was moved here (target ≥ 1 month idle).

## Contents

| File | Moved | Reason | Original path |
|---|---|---|---|
| `curriculumLists_v1.3.js` | 2026-05-18 | Verbatim duplicate of `src/data/curriculumLists.js`. Zero imports across `src/`. The `_v1.3` suffix was a manual backup; both files share the same internal `// v1.3` header. | `src/data/curriculumLists_v1.3.js` |
| `ks2WordData_v27.js` | 2026-06-01 | Superseded KS2 corpus. Not imported at runtime (only `v30` is, via `src/utils/wordLookup.js`). Still referenced by offline pipeline scripts `scripts/buildDefinitions.mjs` + `data-pipeline/cyp_filter.mjs` — update those paths if ever re-run. | `src/data/ks2WordData_v27.js` |
| `ks2WordData_v28.js` | 2026-06-01 | Superseded KS2 corpus. Orphaned — no imports or references anywhere in the repo. | `src/data/ks2WordData_v28.js` |
| `ks2WordData_v29.js` | 2026-06-01 | Superseded KS2 corpus (the version `v30` was patched from). Not imported at runtime; referenced only by `apply_patch_v30.mjs` (the script that produced `v30`) and a doc comment in `definitions.js`. | `src/data/ks2WordData_v29.js` |
| `buildDefinitions.mjs` | 2026-06-01 | Offline one-shot generator for `src/data/definitions.js`. Read the now-retired `ks2WordData_v27.js`. Its output (`definitions.js`) is already committed and live; the generator is stale. | `scripts/buildDefinitions.mjs` |
| `apply_patch_v30.mjs` | 2026-06-01 | Step 1 of the v30 recipe: applied `legacy_enrichment_patch_vFINAL.js` onto `ks2WordData_v29.js`. One-shot; `v30` already produced and committed. | `src/data/apply_patch_v30.mjs` |
| `apply_spellingvoice_v30.mjs` | 2026-06-01 | Step 2 of the v30 recipe: spellingVoice pass overwriting `ks2WordData_v30.js` in place. Moved with step 1 to keep the recipe together. One-shot; already applied. | `src/data/apply_spellingvoice_v30.mjs` |
| `cyp_filter.mjs` | 2026-06-01 | Candidate-discovery tool; loaded external CYP-LEX CSVs (from `~/Downloads`, never in repo) + `ks2WordData_v27.js` to emit new word candidates. Not runnable as-is. | `data-pipeline/cyp_filter.mjs` |
