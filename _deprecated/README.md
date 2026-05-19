# Deprecated files — hold area

Files here are no longer part of any active phase or plan but are being held for one or two cycles before deletion, in case something downstream still depends on them.

**Before deleting** anything in this folder: run a fresh `grep -r <filename>` across `src/` to confirm nothing imports it, and check git history for the date it was moved here (target ≥ 1 month idle).

## Contents

| File | Moved | Reason | Original path |
|---|---|---|---|
| `curriculumLists_v1.3.js` | 2026-05-18 | Verbatim duplicate of `src/data/curriculumLists.js`. Zero imports across `src/`. The `_v1.3` suffix was a manual backup; both files share the same internal `// v1.3` header. | `src/data/curriculumLists_v1.3.js` |
