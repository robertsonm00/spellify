# Spellify — Master Delivery Document
**Last updated: 2026-05-12 | Session: Curriculum catalogue + reference review complete**

This is the single source of truth for everything produced in the curriculum and database sessions. It tells you which files to use, which to ignore, what needs installing, and what the current state of the project is.

---

## Versioning convention (going forward)

All `curriculumLists` files use semantic versioning: `curriculumLists_v[MAJOR].[MINOR].js`

- **Major** = structural change (new strand, schema change, lesson count milestone)
- **Minor** = content additions or patches (new lessons, word list updates, fixes)

The version in the filename matches the version in `docs/CURRICULUM_STRUCTURE.md` amendment log and in the file header comment. The canonical file is always the highest version number.

**Never use files named `_COMPLETE`, `_FINAL`, `_phaseB`, `_phaseC_y1` etc. Those are build artifacts. Use the versioned file only.**

---

## Version history

| Version | Lessons | Words | What changed |
|---|---|---|---|
| v1.0 | 154 stubs | 0 | Phase A/B: strand taxonomy + empty skeleton |
| v1.1 | 154 | 2,099 | Phase C: all 6 year groups populated |
| v1.2 | 174 | 2,374 | HeadStart Primary review: 20 new lessons |
| **v1.3** | **175** | **2,388** | **St Richard's review: -il endings fixed, long-a-before-fst added** |

**The file to use: `curriculumLists_v1.3.js`**

---

## Files to install

Only these three files need to be in the Spellify project. Everything else is documentation or a superseded artifact.

| File | Install to | Status |
|---|---|---|
| `curriculumLists_v1.3.js` | `src/data/curriculumLists.js` | ✅ **Install this** |
| `ks1WordData_v13.js` | `src/data/ks1WordData_v13.js` | ✅ Already in project |
| `ks2WordData_v26.js` | `src/data/ks2WordData_v26.js` | ✅ Already in project |

### Installation commands

```bash
# From project root: ~/project-X-1/spellify

cp ~/Downloads/curriculumLists_v1.3.js src/data/curriculumLists.js
npm start
node checkCoverage.mjs

git add src/data/curriculumLists.js
git commit -m "feat(curriculum): v1.3 — 175 lessons, all NC gaps closed

175 lessons, 2,388 word entries, Y1-Y6 complete.
Closes two NC gaps from St Richard's review:
- y2-ph-le-el-al-endings now includes -il (pencil, fossil, nostril, pupil)
- y3-pt-long-a-fst added (path, class, father, grass)

Reference review complete. Structure: docs/CURRICULUM_STRUCTURE.md v1.4"

git push
```

---

## Documentation files to commit

| File | Commit to |
|---|---|
| `CURRICULUM_STRUCTURE.md` | `docs/CURRICULUM_STRUCTURE.md` |
| `PHASE_C_DELIVERY.md` | `docs/PHASE_C_DELIVERY.md` |
| `SPELLIFY_MASTER_DELIVERY.md` | `docs/SPELLIFY_MASTER_DELIVERY.md` |
| `Spellify_Curriculum_Gap_Analysis.pdf` | `docs/Spellify_Curriculum_Gap_Analysis.pdf` |

```bash
mkdir -p docs
cp ~/Downloads/CURRICULUM_STRUCTURE.md docs/
cp ~/Downloads/PHASE_C_DELIVERY.md docs/
cp ~/Downloads/SPELLIFY_MASTER_DELIVERY.md docs/
cp ~/Downloads/Spellify_Curriculum_Gap_Analysis.pdf docs/
git add docs/
git commit -m "docs: complete curriculum documentation package v1.4"
git push
```

---

## Files to ignore (superseded build artifacts)

| File | Superseded by |
|---|---|
| `curriculumLists_COMPLETE.js` | `curriculumLists_v1.3.js` |
| `curriculumLists_FINAL.js` | `curriculumLists_v1.3.js` |
| `curriculumLists_phaseB.js` | `curriculumLists_v1.3.js` |
| `curriculumLists_phaseC_y1.js` through `_y1to5.js` | `curriculumLists_v1.3.js` |
| `ks1WordData_v12.js` | `ks1WordData_v13.js` |
| `ks2WordData_v8.js` through `ks2WordData_v25.js` | `ks2WordData_v26.js` |

---

## Current project state

### In the app right now

| Component | Status |
|---|---|
| `src/data/ks1WordData_v13.js` | ✅ Installed and verified |
| `src/data/ks2WordData_v26.js` | ✅ Installed and verified |
| `src/utils/wordLookup.js` | ✅ Built and working |
| `src/data/curriculumLists.js` | ⚠️ Phase B skeleton (v1.0) — needs replacing with v1.3 |
| `scripts/checkCoverage.mjs` | ✅ In project, passes exit code 0 |
| `docs/CURRICULUM_STRUCTURE.md` | ⚠️ v1.0 in repo — needs updating to v1.4 |

### Commits already on GitHub

```
feat: integrate v13/v26 word data via wordLookup
fix: backfill 31 Y1 example sentences in ks1WordData_v13
docs: add curriculum structure reference (Phase A)
feat: replace curriculumLists with Phase B skeleton (154 lesson stubs)
```

### What to do next (in order)

1. Install `curriculumLists_v1.3.js` → `src/data/curriculumLists.js`
2. Run `npm start` — app should compile cleanly
3. Run `node checkCoverage.mjs` — expect exit code 0, 100% coverage
4. Commit and push (see commands above)
5. Commit docs folder (see commands above)

---

## Curriculum catalogue (v1.3)

| Year | Phonics | Patterns | Morphology | Etymology | Statutory | Total | Words |
|---|---|---|---|---|---|---|---|
| Y1 | 27 | 7 | 0 | 0 | 4 | 38 | ~528 |
| Y2 | 8 | 12 | 6 | 0 | 4 | 30 | ~434 |
| Y3 | 5 | 10 | 7 | 3 | 5 | 30 | ~414 |
| Y4 | 0 | 12 | 8 | 2 | 3 | 25 | ~344 |
| Y5 | 0 | 8 | 10 | 7 | 5 | 30 | ~407 |
| Y6 | 0 | 4 | 6 | 5 | 5 | 20 | ~261 |
| **Total** | **40** | **53** | **37** | **17** | **26** | **175** | **2,388** |

---

## Word databases (current)

| Database | Version | Words | Coverage |
|---|---|---|---|
| KS1 | v13 | 1,368 (Y1: 770, Y2: 598) | 100% of curriculumLists Y1/Y2 |
| KS2 | v26 | 2,917 (Y3/4: 1,852, Y5/6: 1,065) | 100% of curriculumLists Y3–Y6 |
| **Combined** | | **4,285** | **100% overall** |

---

## Design principles (summary)

Full text in `docs/CURRICULUM_STRUCTURE.md` Section 14 and `docs/PHASE_C_DELIVERY.md` Section 6.

**14.1 Statutory word embedding** — statutory words appear in both their dedicated statutory lessons AND in pattern/morphology lessons where they exemplify the target rule. Multiple exposures across contexts drive retention.

**14.2 NC floor, enrichment ceiling** — full NC coverage at every year group is the baseline. Etymology and advanced Morphology are the stretch layer. Three tiers: accountability (teachers/schools) → grade-level mastery (every child) → enrichment (curious children who want more). The enrichment tier is Spellify's commercial differentiator.

**14.3 Teacher List Builder (future, deferred)** — teachers build custom weekly class lists from the statutory pool and curriculum catalogue, deployed to their class in Spellify. Requires teacher auth + workflow research. Research question: *"How do you choose your class's spelling words each week?"*

---

## Reference review status

| Source | Finding | Action |
|---|---|---|
| NC 2014 English Appendix 1 | Foundation of all content | Ongoing alignment |
| HeadStart Primary Y1-Y6 overview | 25 gaps found | 20 lessons added (v1.2) |
| St Richard's Catholic Primary weekly lists | Same NC source confirmed; 2 minor gaps | 2 fixes applied (v1.3) |
| Further school lists | **Not needed** — one school = one selection from same NC pool | Review closed |

**Reference review is complete. No further external source review needed.**

---

*Update this document whenever a new curriculumLists version is produced.*
