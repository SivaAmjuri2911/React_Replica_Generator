import { z } from 'zod';
import type { BaseSourceFile, ScenarioSpecGenerationRequest } from './ScenarioSpecGenerationService.js';
import type { ScenarioSpecDraft } from '../../domain/models/ScenarioSpecDraft.js';

/**
 * The schema and prompt every provider-specific generation service is held
 * to — kept in one place so switching/adding a provider (see
 * ClaudeScenarioSpecGenerationService, OpenAiScenarioSpecGenerationService)
 * can never drift into asking a different model a subtly different
 * question. Provider services differ only in how they call their SDK and
 * enforce this same contract's output.
 */

const textReplacementSchema = z.object({ from: z.string(), to: z.string() });
const fileRenameSchema = z.object({ fromRelativePath: z.string(), toRelativePath: z.string() });
const colorSwapSchema = z.object({ fromHex: z.string(), toHex: z.string() });
const manuallyAuthoredFileSchema = z.object({ relativePath: z.string(), content: z.string() });

export const scenarioSpecDraftSchema = z.object({
  scenarioName: z.string(),
  outputFolderBaseName: z.string(),
  testPrefix: z.string(),
  textReplacements: z.array(textReplacementSchema),
  fileRenames: z.array(fileRenameSchema),
  colorSwaps: z.array(colorSwapSchema),
  transformableRelativePaths: z.array(z.string()),
  manuallyAuthoredFiles: z.array(manuallyAuthoredFileSchema),
});

export const SCENARIO_SPEC_DRAFT_SCHEMA_NAME = 'scenario_spec_draft';

export const SCENARIO_SPEC_DRAFT_SYSTEM_PROMPT = `You are authoring a transformation spec that turns one existing React project (the "base") into a new scenario with a different domain/entity, while preserving its structure, architecture, and code quality exactly. Your output feeds a fully deterministic pipeline — you never get a second pass, so precision matters more than creativity.

Follow these rules exactly (they were learned the hard way, from real generations that went wrong):

1. FILE CATEGORIZATION — every source file must go into exactly one bucket:
   - "transformableRelativePaths": the file's structure stays identical; only specific tokens
     (entity names, field names, labels, routes, colors) change. Handled by literal, ordered
     find/replace across the whole file. Only safe when every occurrence of each replaced token
     means the same single thing throughout that file.
   - "manuallyAuthoredFiles": the file needs genuinely new prose/content (e.g. a seed-data file's
     actual records, a README's body, a test file's assertions), OR the same word/token/color is
     used for two unrelated meanings in the same file (a blind find/replace would corrupt one of
     them — e.g. a field literally named "response" versus the English word "response" used for an
     HTTP response variable in the same file). When in doubt, prefer this bucket — a hand-written
     file is always safe; a mis-targeted find/replace silently corrupts code.
   - Anything else (configs, boilerplate, files with no scenario-specific content): omit from both
     lists entirely — it is copied byte-for-byte, untouched.
   - NEVER reference a file path that isn't one of the exact paths given to you in "Base project
     source files" below. Every entry in "transformableRelativePaths", and every "fromRelativePath"
     in "fileRenames", must be copy-pasted from a path that section actually lists — not a path you
     assume must exist because of what the UI looks like. A real example of this going wrong: a base
     project rendered "coming soon" placeholder content for several unbuilt routes directly inline
     inside App.jsx (no separate component file for it at all), and a draft invented a
     "ComingSoonPage.jsx" path that was never in the file list — the pipeline has no such file to
     transform, so the whole generation fails immediately. If you want to reference where some UI
     content lives, find its actual file first.

2. COLORS — every color used anywhere in the base project's transformable/manually-authored files
   must appear in "colorSwaps" mapped to a NEW hex value, with no exceptions — including near-white
   neutrals, borders, and text grays, not just obvious "brand" colors. Pick an internally consistent
   different color family (e.g. navy/blue → slate/teal) and keep status colors in a recognizable hue
   for their meaning (green-ish = good/open, red-ish = urgent/error).

3. CLASS NAME / JSX PARITY — if a CSS file's class names get renamed to match the new entity,
   the paired .jsx file's className references must use the exact same new names. Every JSX/CSS
   pair must stay in sync — this belongs in the same textReplacements list so both files change
   together. NEVER include the leading "." in a class-rename entry's "from"/"to" — write it as
   "from": "bid-row", "to": "ticket-row" (bare name, no dot), not "from": ".bid-row". A CSS
   selector always has a literal "." immediately before the class name (".bid-row { ... }"), but a
   JSX className value never does (className="bid-row"). A dot-prefixed replacement therefore only
   ever matches inside the .css file — the .jsx file's className is left completely untouched, so
   the two go out of sync (the DOM ends up with a class no stylesheet rule matches, and any test
   asserting the new name fails) even though you thought you renamed it everywhere. The bare
   (no-dot) form matches correctly in both places: inside a CSS selector, the "." stays as its own
   untouched character right before the matched text; inside a JSX className string, there's no
   dot to worry about at all.

4. TEST FILES — if the base project has a test file, its replacement content in
   "manuallyAuthoredFiles" MUST wrap every test's description in the exact marker format:
   ":::{testPrefix}_test_{N}:::{human description}:::{weightage}:::" where N starts at 1 and
   increments with no gaps, and weightage values are positive integers. testPrefix must not appear
   in the list of already-used prefixes given to you.

5. SEED/SAMPLE DATA FILES (e.g. sampleData.js) — regenerate with new records for the new scenario,
   as a manually-authored file. This data is seed-only: never wire it into component imports/logic
   even if the base project didn't either.

6. LINKS/ASSETS — never invent placeholder URLs (e.g. "PLACEHOLDER_IMAGE_URL") for
   images/videos/screenshots. If the base file's manually-authored content includes such a link,
   keep the base scenario's original URL unchanged rather than fabricating a broken one.

7. CODE QUALITY — carry forward these baseline patterns into any manually-authored component code:
   guard against a null/undefined record after loading finishes (not just loading/error states)
   before rendering its fields, and never leave an unused/disconnected handler function.

8. NAMING — "scenarioName" is kebab-case (e.g. "ticket-management"). "outputFolderBaseName" is
   PascalCase (e.g. "TicketManagement"). Both must describe the new scenario's domain, not the base
   project's.

9. FILE RENAMES vs. TRANSFORMABLE PATHS — "fileRenames" entries use the base project's ORIGINAL
   relative paths as "fromRelativePath". Renames are applied first, so every other list
   ("transformableRelativePaths", and any manually-authored file that replaces a renamed file) must
   reference the file by its NEW path, never the old one. Every relative path you use anywhere is
   relative to the solution_code root and always uses forward slashes, e.g. "src/components/Foo.jsx".
   Never include "package.json" or "package-lock.json" in any list — their "name" field is rewritten
   automatically by the pipeline, outside this spec.

   9a. A RENAMED COMPONENT'S NAME MUST BE IDENTICAL EVERYWHERE — the basename you choose in a
   "fileRenames" entry's "toRelativePath" (e.g. renaming "BidListPage.jsx" to
   "ServiceRequestListPage.jsx" means the component's name is now exactly "ServiceRequestListPage")
   is the ONE name that must appear, unchanged, in every single place that file is referenced: the
   default export/component name inside the file itself, every import statement elsewhere of the
   form 'import X from "./components/X"' (both the imported name AND the path), and every JSX usage
   like '<X />'. A real example of this failing: a file was renamed to "ServiceRequestListPage.jsx",
   but textReplacements separately produced an import reading
   'import ServiceListPage from "./components/ServiceListPage"' — a different, shorter name than the
   actual file — so the app failed to even build (Vite: "Failed to resolve import ... Does the file
   exist?") and zero tests could run. Before finishing, for every fileRenames entry, search
   transformableRelativePaths' content for every import/usage of the OLD name and confirm it was
   replaced with the exact SAME new basename you used in "toRelativePath" — not an approximation of
   it.

   9b. "textReplacements" ARE APPLIED AS A CHAIN, IN THE ORDER YOU LIST THEM — each entry's output
   feeds into the next entry's matching. This means a later, generic bare-word entry can accidentally
   re-match text an earlier entry (or a fileRenames-driven rename) already produced, corrupting it
   further. A real example of this failing: a file was renamed so its component became
   "VendorsPage", but a separate textReplacements entry {"from": "Vendor", "to": "Vendors"} (meant
   to pluralize the plain word elsewhere) ran afterward and ALSO matched the substring "Vendor"
   inside the already-renamed "VendorsPage" text — everywhere that identifier appeared (the
   component's own function name, its export statement, and every import of it), it became
   "VendorssPage" instead, breaking the build ("Failed to resolve import ... VendorssPage"). Before
   finishing, check whether any textReplacements "to" value (or any fileRenames toRelativePath
   basename) already contains another textReplacements entry's "from" value as a literal substring —
   if a bare entity word like "Vendor" is also a substring of a component name you're renaming to
   (like "VendorsPage"), that generic entry WILL re-fire on the identifier and corrupt it. Resolve
   this by not introducing the collision: pick component names and plain-word replacements that
   don't literally contain one another, or ensure the entity word is only pluralized/changed once,
   consistently, rather than through two separate entries that both touch it.

10. WHEN NO SCENARIO DESCRIPTION IS GIVEN — invent one yourself. Read the base project's actual
    code (entity names, fields, routes, UI copy) to understand what kind of app it is, then pick a
    DIFFERENT real-world domain that has an analogous shape: similar entity count, similar CRUD/list/
    detail structure, similar complexity — so every base file still maps cleanly onto the new domain
    (e.g. a bid-tracking app's shape also fits ticket management, equipment rental, or event RSVPs,
    but not a chat app or a game). Avoid domains that are trivial synonyms of the base (don't just
    rename "bid" to "offer"), and avoid anything already implied by an already-used test prefix
    you're given. State your chosen domain through "scenarioName"/"outputFolderBaseName" as normal —
    there is no separate field for it.

11. ROUTE PATHS ARE A SEPARATE LITERAL FROM THE DISPLAY NAME — DO THIS FOR EVERY SINGLE FILE
    RENAME, NOT JUST THE ONES THAT LOOK LIKE THEY HAVE A ROUTE PARAMETER. A URL/route string like
    "<Route path=\"/pod\">", "<Link to=\"/pod\">", or "href=\"/pod\"" is almost always lowercase and
    does NOT contain the capitalized word your entity-rename replacement targets (e.g. renaming
    "POD" -> "Products" does nothing to the separate literal "/pod"). This has been the #1 cause of
    a generated scenario failing its own tests, and it keeps happening the same way: the model fixes
    the ONE route that has an obvious dynamic segment (e.g. "/bid/:id") and then stops, missing the
    plain static routes for every OTHER renamed page (e.g. "/pod", "/vendor", "/user" all being left
    unchanged even though PODPage/VendorPage/UserPage were all renamed). Do not stop after the first
    route you notice. Concretely, before finishing:
    a. List every entry in your own "fileRenames" array.
    b. For each one, search the base project's App.jsx/router file and Sidebar (or nav) file for
       every <Route path>, <Link to>, href, and navigate()/useNavigate() call that could plausibly
       correspond to that file (usually a lowercase form of its old name, e.g. "PODPage" -> "/pod").
    c. Add one textReplacements entry per route literal you find, "from" the exact old string, "to"
       the exact new one — this is a value most base projects derive as lowercase(oldName minus any
       "Page" suffix), but READ THE ACTUAL FILE, don't guess the pattern.
    d. Only move on once every fileRenames entry has a matching route-literal replacement (or you've
       confirmed that file genuinely has no route referencing it).

12. THE TEST FILE'S ASSERTIONS MUST MATCH WHAT THE TRANSFORMED CODE ACTUALLY PRODUCES — before
    writing any getByText/getByRole/href/route assertion in the manually-authored test file, trace
    through your own textReplacements/fileRenames list and confirm the exact resulting string
    (exact casing, exact singular/plural — do not assume a label pluralizes or capitalizes the way
    you'd naturally write it; use the literal output of your own replacements). A test asserting
    text or a route your own transformableRelativePaths changes will never actually produce is a
    guaranteed self-inflicted failure, indistinguishable at review time from a real bug. This
    includes every small UI label, not just entity names and routes — a dropdown option, a filter
    label, a table header cell: if your test asserts new wording for it (e.g. "Sort by Date" ->
    "Sort by Request Date"), there must be a matching textReplacements entry that actually produces
    that new wording, or the assertion will fail against the base scenario's original, untouched
    text. When in doubt, prefer asserting text you're CERTAIN is unchanged over inventing wording
    you haven't actually wired up a replacement for.

    12a. TEXT SPLIT ACROSS "<br />" IS NOT ONE CONTIGUOUS STRING — a two-line label in JSX is
    often written as "First line<br />Second line", not "First line Second line" with a plain
    space. A textReplacements entry with "from" written as if it were one continuous phrase (e.g.
    "from": "Bid Time Remaining") will NEVER match "Bid Time<br />Remaining" — the literal
    substring "Bid Time Remaining" doesn't exist in that source, so the replacement silently does
    nothing and the base scenario's original wording survives untouched. Check the base file's
    actual source for "<br" before assuming two adjacent words form one replaceable phrase; if a
    label is split by "<br />", write two separate replacements (one per line) instead of one
    replacement spanning both.

13. NEVER COPY THE "--- FILE: path ---" HEADERS INTO YOUR OWN OUTPUT — the "Base project source
    files" section below uses "--- FILE: some/path ---" lines purely so you can tell where one
    file's contents end and the next begin; it is not part of any actual file's real content. A
    real example of this failing: a manually-authored test file's "content" began with the literal
    line "--- FILE: src/__tests__/Foo.test.jsx ---" as if it were valid JavaScript, which is a
    syntax error ("Expected \\";\\" but found \\":\\"") that crashed the entire test file before a
    single test could run. Every "content" value in "manuallyAuthoredFiles" must start directly
    with real file content (an import statement, a comment, etc.) — never with a path header,
    label, or any other line describing the file itself.

Respond with ONLY the structured draft — no prose, no explanation outside the schema fields.`;

export function buildScenarioSpecDraftUserPrompt(request: ScenarioSpecGenerationRequest): string {
  const filesSection = request.baseSolutionCodeFiles
    .map((file: BaseSourceFile) => `--- FILE: ${file.relativePath} ---\n${file.contents}`)
    .join('\n\n');

  return [
    request.scenarioDescription
      ? `New scenario description: ${request.scenarioDescription}`
      : 'No scenario description was given — invent an appropriate new scenario yourself, per rule 10.',
    `Test prefixes already used by other scenarios (do not reuse any of these): ${
      request.usedTestPrefixes.length > 0 ? request.usedTestPrefixes.join(', ') : '(none yet)'
    }`,
    '',
    'Base project source files (paths are relative to the base solution_code root):',
    '',
    filesSection,
  ].join('\n');
}

export function buildScenarioSpecRevisionUserPrompt(
  request: ScenarioSpecGenerationRequest,
  previousDraft: ScenarioSpecDraft,
  failureSummary: string
): string {
  const filesSection = request.baseSolutionCodeFiles
    .map((file: BaseSourceFile) => `--- FILE: ${file.relativePath} ---\n${file.contents}`)
    .join('\n\n');

  return [
    'You previously drafted a transformation spec for this exact base project. It was actually',
    'applied to the code and tested — here is what happened.',
    '',
    'YOUR PREVIOUS DRAFT (the exact JSON you returned last time):',
    JSON.stringify(previousDraft, null, 2),
    '',
    'WHAT WENT WRONG WHEN IT WAS APPLIED AND TESTED:',
    failureSummary,
    '',
    'Fix ONLY what is necessary to resolve this — keep everything that was already working intact,',
    'don\'t re-invent parts of the draft that had nothing to do with the failure. Return a COMPLETE,',
    'corrected draft in the exact same schema as before (not a diff, not an explanation of what you',
    'changed). Common root causes worth checking first, since these have caused this exact failure',
    'pattern before: a route path literal (<Route path>, <Link to>, href, navigate()) that was never',
    'updated even though its page was renamed; a renamed component whose import statement or JSX',
    'usage elsewhere still uses the old name; a CSS class rename written with a leading "." so it',
    'only matched the stylesheet and never touched the JSX className; a label split across a',
    '"<br />" tag that a single-phrase replacement silently failed to match; a generic bare-word',
    'textReplacements entry that re-matched and corrupted a name a rename/earlier entry already',
    'produced (e.g. "Vendor" -> "Vendors" re-firing inside an already-renamed "VendorsPage",',
    'producing "VendorssPage"); a manually-authored file whose "content" begins with a literal',
    '"--- FILE: path ---" header copied from how base files were shown to you, which is a syntax',
    'error, not real code; or a test assertion that expects wording your own textReplacements list',
    'doesn\'t actually produce.',
    '',
    'Base project source files (paths are relative to the base solution_code root):',
    '',
    filesSection,
  ].join('\n');
}
