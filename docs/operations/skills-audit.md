# `.github/skills` audit

**Audited:** 2026-07-30  
**Action taken:** report only; no pre-existing skill was deleted, moved, or
modified.

## Executive recommendation

The repository contained **280 pre-existing skills** occupying approximately
**83 MB**. This change added only the six requested, repository-specific
`placeme-*` skills, bringing the on-disk total to 286.

Recommended steady state:

- retain the **6 PlaceMe skills** as the primary engineering workflow;
- retain **25 valid existing skills** that directly support this JavaScript SaaS
  lifecycle;
- conditionally retain **3 useful legacy skills** after their metadata is
  normalized and revalidated;
- remove or archive **252 unrelated, redundant, unsupported, or overly
  specialized skills** in a separate, explicitly approved cleanup.

“Remove” in this report is a recommendation only. Nothing has been deleted.

## Selection principles

A retained generic skill must directly help this repository build, secure, test,
document, or operate React/Vite, Express, Supabase/RLS, LiveKit, AssemblyAI,
Gemini, GitHub, and containerized deployments. A skill is recommended for
removal when it is domain-specific to science, medicine, blockchain, another
language/runtime, creative artifact generation, unused integrations, or when
the focused PlaceMe workflow makes it redundant.

The six PlaceMe skills take precedence over any generic skill:

| Skill | Production role |
|---|---|
| `placeme-feature` | approved spec → plan → TDD implementation → docs/evidence |
| `placeme-review` | specification, regression, concurrency, architecture review |
| `placeme-security` | auth, authorization, RLS, consent, secrets, API/provider security |
| `placeme-pilot` | real-user, provider-capacity, monitoring, and rollback readiness |
| `placeme-release` | release, migration, smoke-test, rollout, and recovery control |
| `placeme-incident` | containment, recovery, root cause, and corrective actions |

All six pass the Codex skill validator.

## Recommended retained skills

### Engineering

| Skill | Why retain it | Validation |
|---|---|---|
| `brainstorming` | Helps turn an early idea into a reviewed design before the PlaceMe specification is approved. | Valid |
| `differential-review` | Adds risk-first diff analysis for PR and security review. | Valid |
| `executing-plans` | Supports disciplined execution of an already approved implementation plan. | Valid |
| `finding-duplicate-functions` | Detects semantic duplication that AI-assisted codebases commonly accumulate. | Valid |
| `finishing-a-development-branch` | Supports clean branch/PR integration after verification gates pass. | Valid |
| `receiving-code-review` | Encourages evidence-based evaluation of review feedback instead of blind changes. | Valid |
| `systematic-debugging` | Enforces root-cause-first diagnosis for bugs and failing tests. | Valid |
| `using-git-worktrees` | Isolates parallel feature work and reduces contamination of a dirty worktree. | Valid |
| `writing-plans` | Converts approved specifications into explicit, reviewable implementation tasks. | Valid |

### Security

| Skill | Why retain it | Validation |
|---|---|---|
| `agentic-actions-auditor` | Reviews GitHub AI workflows for prompt-injection and unsafe CI execution. | Valid |
| `codeql` | Provides interprocedural security scanning for JavaScript and workflow integration. | Valid |
| `defense-in-depth` | Helps place validation at API, domain, database, and provider boundaries. | Valid |
| `insecure-defaults` | Detects fail-open configuration, hardcoded credentials, and permissive production behavior. | Valid |
| `sarif-parsing` | Processes CodeQL/Semgrep results into deduplicated review evidence. | Valid |
| `semgrep` | Provides fast static security and bug scanning for the JavaScript codebase. | Valid |
| `sharp-edges` | Identifies APIs/configuration that make insecure use too easy. | Valid |
| `supply-chain-risk-auditor` | Reviews npm dependency health and takeover/maintenance risk. | Valid |
| `variant-analysis` | Searches the repository for sibling instances after a bug or vulnerability is found. | Valid |

### Testing

| Skill | Why retain it | Validation |
|---|---|---|
| `condition-based-waiting` | Replaces flaky sleeps with state polling in asynchronous room/provider tests. | Normalize metadata before Codex use |
| `playwright-skill` | Supports deployed/local browser journeys and representative UI/device checks. | Valid |
| `property-based-testing` | Strengthens validation, state-machine, parsing, and boundary coverage. | Valid |
| `test-driven-development` | Reinforces the repository's Red → Green → Refactor requirement. | Valid |
| `testing-anti-patterns` | Prevents mock-only assertions and production code added solely for tests. | Normalize metadata before Codex use |
| `verification-before-completion` | Requires fresh evidence before completion claims. | Valid |

### Documentation

| Skill | Why retain it | Validation |
|---|---|---|
| `doc-coauthoring` | Supports iterative specifications, ADRs, runbooks, and reader verification. | Valid |

### Operations

| Skill | Why retain it | Validation |
|---|---|---|
| `devcontainer-setup` | Can standardize Node 22 and agent tooling if the team later adopts a dev container. | Valid |
| `gh-cli` | Supports authenticated GitHub PR, issue, check, and release workflows. | Valid |
| `root-cause-tracing` | Helps trace deep worker/provider failures back to the originating event. | Normalize metadata before Codex use |

## Recommended removals

The following **252** pre-existing skills are not needed for the focused PlaceMe
engineering operating system. Common reasons are domain mismatch, unused tool or
service integration, specialist non-JavaScript runtime, creative/artifact
generation, redundant meta-agent workflow, or overlap with the six PlaceMe
skills.

```text
1stskill
adaptyv
address-sanitizer
aeon
aflpp
algorand-vulnerability-scanner
algorithmic-art
anndata
arboreto
ask-questions-if-underspecified
astropy
atheris
audit-augmentation
audit-context-building
audit-prep-assistant
autoskill
benchling-integration
bgpt-paper-search
bids
biopython
bioservices
brand-guidelines
bulk-rnaseq
burpsuite-project-parser
c-review
cairo-vulnerability-scanner
canvas-design
cargo-fuzz
cellxgene-census
checkpoint-mode
chrome-mcp-troubleshooting
cirq
citation-management
claude-api
claude-d3js-skill
claudeskill-loki-mode
clinical-decision-support
clinical-reports
cobrapy
code-maturity-assessor
collision-zone-thinking
consciousness-council
constant-time-analysis
constant-time-testing
cosmos-vulnerability-scanner
coverage-analysis
crypto-protocol-diagram
dask
database-lookup
datamol
debug-buttercup
deepchem
deeptools
depmap
design-motion-principles
designing-workflow-skills
dhdna-profiler
diagramming-code
diffdock
dimensional-analysis
dispatching-parallel-agents
dnanexus-integration
docx
dwarf-expert
entry-point-analyzer
esm
etetoolkit
exa-search
exploratory-data-analysis
ffuf-skill
firebase-apk-scanner
flowio
fluidsim
fp-check
frontend-design
frontend-slides
fuzzing-dictionary
fuzzing-obstacles
gardening-skills-wiki
generate-image
geniml
genotoxic
geomaster
geopandas
get-available-resources
gget
ginkgo-cloud-lab
git-cleanup
glycoengineering
graph-evolution
gtars
guidelines-advisor
harness-writing
histolab
hugging-science
hypogenic
hypothesis-generation
imaging-data-commons
impeccable
infographics
internal-comms
interpreting-culture-index
inversion-exercise
ios-simulator-skill
iso-13485-certification
labarchive-integration
lamindb
latchbio-integration
latex-posters
let-fate-decide
libafl
libfuzzer
liteparse
literature-review
markdown-mermaid-writing
market-research-reports
markitdown
matchms
matlab
matplotlib
mcp-builder
mcp-cli
medchem
mermaid-to-proverif
meta-pattern-recognition
modal
modern-python
molecular-dynamics
molfeat
mutation-testing
networkx
neurokit2
neuropixels-analysis
nextflow
omero-integration
open-notebook
openclaw
opentrons-integration
optimize-for-gpu
ossfuzz
pacsomatic
paper-lookup
paperzilla
parallel-web
pathml
pathway-enrichment
pdf
peer-review
pennylane
phylogenetics
polars
polars-bio
pptx
pptx-posters
preserving-productive-tensions
primekg
prompt-optimization
protocolsio-integration
pufferlib
pulling-updates-from-skills-repository
pydeseq2
pydicom
pyhealth
pylabrobot
pymatgen
pymc
pymoo
pyopenms
pysam
pytdc
pytorch-lightning
pyzotero
qiskit
qutip
rdkit
remembering-conversations
requesting-code-review
research-grants
research-lookup
rowan
ruzzy
scale-game
scanpy
scholar-evaluation
scientific-brainstorming
scientific-critical-thinking
scientific-schematics
scientific-slides
scientific-visualization
scientific-writing
scikit-bio
scikit-learn
scikit-survival
scvelo
scvi-tools
seaborn
seatbelt-sandboxer
second-opinion
secure-workflow-guide
semgrep-rule-creator
semgrep-rule-variant-creator
shap
sharing-skills
simplification-cascades
simpy
skill-creator
skill-improver
slack-gif-creator
solana-vulnerability-scanner
spec-to-code-compliance
stable-baselines3
statistical-analysis
statsmodels
subagent-driven-development
substrate-vulnerability-scanner
sympy
testing-handbook-generator
testing-skills-with-subagents
theme-factory
tiledbvcf
timesfm-forecasting
token-integration-analyzer
ton-vulnerability-scanner
torch-geometric
torchdrug
tracing-knowledge-lineages
trailmark
trailmark-structural
trailmark-summary
transformers
treatment-plans
ui-ux-pro-max
umap-learn
usfiscaldata
using-skills
using-superpowers
using-tmux-for-interactive-commands
vaex
vector-forge
venue-templates
web-artifacts-builder
web-asset-generator
webapp-testing
what-if-oracle
when-stuck
windows-vm
writing-skills
wycheproof
xlsx
yara-rule-authoring
zarr-python
zeroize-audit
```

## Cleanup procedure if later approved

1. Confirm the list with repository owners and any active branches.
2. Capture the current directory manifest and commit boundary.
3. Remove/archive only the exact approved skill directories, never
   `.github/skills` as a whole.
4. Recount skills and verify the six `placeme-*` skills plus retained set remain.
5. Revalidate retained skills and update Copilot/Codex discovery guidance.
6. Commit the cleanup separately so it can be reverted without touching
   application or engineering documentation.

