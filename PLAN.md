# Formly plan

Project: Formly (`form-filler`)

## Confirmed requirements

- Chrome and Edge extension.
- Generated test data, filled immediately by clicking the browser toolbar icon.
- English, French, and Arabic form-label recognition.
- Broad field/type coverage with custom label rules.

## Implementation

1. Create a Manifest V3 extension with a React/TypeScript options page and an action-click service worker.
2. Generate consistent fictional identities and values for 42 field categories.
3. Match autocomplete attributes, labels, accessible names, names, IDs, and placeholders across three languages.
4. Fill matched controls immediately, replacing existing values and filling unknown controls by default.
5. Add switches for replacing values, generic filling of unknown controls, and test passwords; provide custom exact-label rules.
6. Support native text, email, tel, URL, search, number, range, date/time, color, textarea, select, checkbox, and radio controls.
7. Provide a local mixed-language demo, unit tests, browser tests, and an unpacked extension build.

## Boundaries

Operate on the active page's top-level document. No backend or remote profile storage; optional Gemini requests use a user-supplied key. Never submit forms. Skip detected consent controls, payment fields, OTPs, hidden/disabled/read-only controls, and file uploads. Custom widgets, frames, and shadow DOM need future adapters. Constraints that cannot be satisfied are reported as incompatible.

## Future suggestions

- Algerian and French address/phone datasets, separately selectable from name language.
- A per-site rule editor and reusable test scenarios.
- Custom field generators (text patterns, UUIDs, bounded numbers, date ranges, option lists).
- Dynamic framework dropdown adapters and frame/shadow DOM support.
- Explicit sandbox payment fixtures and file-upload fixtures.
- Repeatable seeded datasets, import/export, and a keyboard shortcut.

## v0.2 interaction correction

Remove the toolbar popup. Register chrome.action.onClicked to fill the clicked tab directly, show a result badge and hover details, and keep the former interface available through right-click → Options.

## v0.3 fresh full-form filling

Migrate older saved settings to replacement and unknown-field filling. Generate fresh identities and generic text, randomize other samples, change bounded values and selected options where alternatives exist, and fill text despite invalid patterns in generic mode. Add repeated-fill and settings-migration regression coverage.

## v0.4 Gemini suggestions

- Make Gemini the first/default Options tab, with local API-key entry, connection test, model choice, enable switch, and clear-cache action.
- When enabled and website access is granted, scan unknown fields automatically after page loads/reloads. Do not fill until the toolbar is clicked.
- Batch unknown field metadata into a structured Gemini request for ten related values per field. Do not transmit entered values.
- Reuse suggestions per tab/form for five minutes, consume different choices, and prune expired session cache using Chrome alarms.
- Preserve local fallback on API failures and check document/field identity before applying delayed responses.
- Verify key handling, scan-only behavior, cached rotation, expiry, browser flow, and responsive layouts with simulated provider responses.

## v0.5 field exclusions

- Add an Excluded fields tab while keeping Gemini the default tab.
- Enable search and header/navigation exclusions by default, including older settings.
- Add exact label/name/ID/placeholder rules and CSS selectors, optionally scoped to a website and its subdomains.
- Apply exclusions before local filling, Gemini scanning, and cached-suggestion filling. Clear Gemini caches when exclusions change and re-read current exclusions before a delayed fill.
- Protect excluded radio groups, persist changes, and verify repeated-click behavior and responsive layouts.

## v0.6 model choice and cache reuse

- Offer a short, checked list of Gemini models and default to the one that answers most reliably; keep the dropdown to models the key can actually reach.
- Retry an overloaded or rate-limited Gemini response briefly before falling back to local words, honouring Retry-After.
- Key each session batch on the tab, origin, model, and language only, and store suggestions under each field's own metadata, so a form that reveals or rewrites fields after filling keeps reusing its batch.
- Request only the fields that are new or exhausted and merge them into the existing batch; bound a batch to 120 fields with the on-screen form taking priority.
- Cover the growing-form case with a browser regression test.

## v0.7 cache controls and first-install experience

- Preserve v0.6 model handling, Gemini retries, and reuse of suggestions across changing forms.
- Add a saved cache duration of 1–60 whole minutes, retaining five minutes for existing installations. Save expiry independently of API-key settings and clear old batches on change.
- Make Clear cache visible, show remaining suggestions and time, and retain the original batch deadline when new fields are added.
- Open a welcome page on the first installation only, with an interactive example, pinning instructions, and links to Gemini, exclusions, and cache settings. Provide a replay link in Options.
- Replace the generic toolbar icon with generated Formly artwork at 16, 32, 48, and 128 pixels; share the branding across Options, onboarding, and documentation.
- Rewrite the README around installation, everyday use, cache controls, privacy, limitations, and development.
- Verify migration, chosen expiry, clearing, dynamic forms, welcome lifecycle, icon loading, and responsive layouts.

## Readable values across every field

- Remove generated ID suffixes from all default values, including companies, roles, addresses, messages, URLs, and passwords.
- Rotate natural English/French/Arabic samples and readable test passphrases; keep native number, date, phone, and color formats.
- Remove random prefixes, ID padding, and character scrambling from the filling engine. Use readable alternatives and complete phrases when minimum lengths require more text.
- Insert explicit custom values without decorations; fixed custom values may repeat. Skip incompatible native values instead of replacing them.
- Reject UUID and hexadecimal ID fragments from Gemini suggestions and cached values.
- Verify every generated category, repeated payloads, password confirmation, length constraints, custom values, and real browser filling.

## v0.8 native side panel

- Keep toolbar clicks as direct fill actions. Add an action context-menu entry and Alt+Shift+F command to open a native side panel.
- Inspect native controls, show filled/skipped details, highlight a selected control, and save targeted custom values or exclusions.
- Store one undo snapshot in the document’s isolated extension context, preserving later edits and rejecting stale document/field references.
- Refresh the panel on tab changes and navigation without adding permanent website access.
- Validate native panel interactions in Chromium, including undo, rules, exclusions, tab changes, and narrow layouts.
