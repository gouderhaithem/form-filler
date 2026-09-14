<p align="center">
  <img src="../public/icons/icon-256.png" width="96" height="96" alt="Formly icon" />
</p>
<h1 align="center">Formly</h1>
<p align="center"><strong>Less typing. More testing.</strong></p>
<p align="center">Fresh test data for the form in front of you. One toolbar click.</p>
<p align="center">Chrome & Edge · Manifest V3 · English / Français / العربية</p>
<p align="center">
  <a href="#get-started">Get started</a> ·
  <a href="#gemini-optional">Gemini</a> ·
  <a href="#your-cache-your-timing">Cache controls</a> ·
  <a href="#development">Development</a>
</p>

![Formly welcome page with an interactive form preview](images/welcome.png)

Formly fills website forms with fictional names, usernames, emails, addresses, and more. Unknown fields get readable words instead of random character strings. Add your own Gemini key for suggestions related to unfamiliar labels.

Click the extension icon to fill the current website. Click again for fresh values. **You control when the form is submitted.**

## What you get

| Feature | What it does |
| --- | --- |
| One-click filling | Fills the active page directly from the toolbar, with a count on the icon. |
| 42 field categories | Identities, contact details, work, addresses, dates, numbers, and short text. |
| Three languages | Recognizes English, French, and Arabic labels; choose the generated data language. |
| Readable unknown values | Uses simple words such as “Garden” and “River”, or short sentences for textareas. |
| Optional Gemini | Prepares related suggestions on page load and keeps a batch ready for your next click. |
| Configurable cache | Choose **1–60 minutes**, with **5 minutes** as the default, or clear it immediately. |
| Custom rules & exclusions | Supply values for your own labels and protect fields that should stay untouched. |
| First-install welcome | A quick setup guide, interactive preview, and links to your settings. |

## Get started

You’ll need Node.js and npm to build from source.

```sh
cd /path/to/form-filler
npm ci
npm run build
```

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Enable **Developer mode** and choose **Load unpacked**.
3. Select the generated **`dist` folder**. Select the folder itself, not an individual file.
4. Follow the welcome page and pin Formly from the browser’s Extensions menu.
5. Open a website with a form and click the Formly toolbar icon.

**Already installed?** Rebuild, then click **Reload** on Formly’s extension card. Your saved settings remain. The welcome page opens automatically only on a new installation; you can revisit it from **Options → Welcome guide**.

Right-click the toolbar icon → **Options** to configure Formly. Gemini is the default tab. The other tabs are **Generator**, **Custom fields**, and **Excluded fields**.

The toolbar badge shows the number of filled fields. Hover over the icon for details. A `!` badge means filling failed; browser internal pages and extension stores restrict extension access.

## Side panel

Right-click the toolbar icon → **Open Formly panel**, or press **Alt + Shift + F**. The panel stays beside the website and follows the active tab. Ordinary toolbar clicks fill the page and wait if AI data is still pending.

Use the field list to inspect filled/skipped results, highlight a control, save a custom value, or exclude a field. Panel custom rules target a CSS selector on the exact hostname and take priority over autocomplete. You can change their values or delete them in **Options → Custom fields**. If the website changes its markup, recreate the rule. Panel exclusions appear in **Options → Excluded fields**.

**Undo last fill** restores the last fill for the current document and preserves controls changed since then. Reloading clears undo. Original values stay in the isolated extension context of the page, never in Gemini prompts or extension storage. Undo cannot reverse other website actions triggered by change events.

The list refreshes after tab changes and periodically while open. On a new website, click Formly or reopen its panel from the icon’s menu if access is needed. Restricted browser pages, frames, and custom widgets retain the existing limitations.

The panel needs Chrome 118+ or a compatible Edge version. Customize the shortcut in your browser’s extension shortcuts page.

## Request inspector

Choose **Requests → Start recording** in the side panel before submitting a form. Select a request to inspect the method, endpoint, HTTP status, duration, request headers/body, and response headers/body. Use the endpoint filter and Request/Response tabs to navigate the history. Copy copies the displayed body, including any redactions.

Chrome requires the `debugger` permission in the extension manifest for this feature. Recording itself remains off until started. Chrome displays a debugging notice while the recorder is attached. Stop recording to detach it. Switching tabs in the same window stops recording and preserves the captured history. Closing the recorded tab clears history. A new recording starts a fresh history.

Captures stay in service-worker memory, with no persistence, browser sync, or Gemini transmission. Known credential headers, sensitive query parameters, and named JSON/form fields are hidden. Unstructured bodies may still contain submitted information. History contains at most 50 Fetch, XHR, and document requests. Request and response previews are limited to 64 KB each. Multipart and binary payloads are omitted. Streaming responses, browser-evicted bodies, and separate iframe/worker targets may be unavailable. Headers are those Chrome exposes in its Network events.

Redirects appear as separate rows. Network failures show the browser error. An HTTP 2xx status does not prove that the application accepted the form: inspect its response for validation errors. Requests are not automatically correlated to a particular form submission.

Opening DevTools, another debugger, or canceling Chrome’s debugging notice can interrupt recording. Start again when the tab is available.

## Edit and resend

1. Select a completed capture and click **Edit & resend**.
2. Edit the **Method** and **Request URL**. Use **Params** for query parameters, **Headers** for request headers, and **Body** for JSON, text, or URL-encoded form data.
3. Replace or remove `[hidden]` values in the URL/body. Leave **Website session** selected to use the original tab’s cookies and browser request context. **Reuse captured authentication** restores captured Authorization/CSRF headers without revealing them. You can override a captured header by entering its name and a new value in Headers.
4. Click **Send** and grant destination website access when Chrome asks. This makes a real request, even if recording is stopped.
5. Inspect **New response**, status, duration, and **Response headers**. Expand **Sent request** and **Original response** to compare. Use **Resend history** to review the last 10 attempts.

The original capture stays unchanged. Drafts and resend results stay only in the open editor. Closing it, leaving Requests, or clearing history discards them. Entered credentials are kept in the draft while editing; known credential fields in result snapshots are hidden. Nothing is sent to Gemini or saved in extension storage.

**Website session** defaults to including the source tab’s current cookies. Keep the original tab selected and on the captured page. Chrome computes Origin and Referer from that document; page CORS rules apply. The send is pinned to that document so navigation cannot redirect an in-flight operation into a different page. Requests from unsupported frames or a changed page may require a fresh recording.

Captured authentication header values stay only in recorder memory, never in the editor response or extension storage. They are removed when the capture is cleared, evicted, replaced by a new recording, or its tab closes. Stopping recording keeps them available with the capture. Reuse is restricted to the original API origin, including scheme and port. To send elsewhere, turn reuse off and enter credentials for that destination. Expired or rotating tokens need a fresh capture or manually edited header.

**Extension** mode is available for independent API calls and starts with cookies off. Even with cookies enabled, its Origin/Referer can differ and a website may reject it. Forbidden headers such as Cookie, Host, Origin, and Content-Length cannot be manually overridden. Native form navigation and custom per-request referrer policies are not reproduced exactly by Fetch.

GET and HEAD omit the draft body. JSON is validated when Content-Type is JSON. Bodies and response previews are limited to 64 KB; binary responses and multipart uploads are unsupported. If the captured body was unavailable, enter a replacement before sending.

Redirects are stopped rather than followed automatically; Chrome hides some redirect details. Enter the destination URL to send there. Requests time out after 20 seconds and are never automatically retried. **Cancel** stops waiting; it does not undo a request the server already received. HTTP 2xx can still contain an application error, so read the response.

## Gemini (optional)

Local generation works without an account or API key. To add contextual suggestions:

1. Open **Options → Gemini** and enter your key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Click **Test key** to check which supported models your key can reach. This lists models; it does not generate test data.
3. Enable **Use Gemini for unknown fields**, then click **Save settings**.
4. Accept the browser’s website-access request. This lets Formly prepare suggestions automatically when websites load, forms appear later, or you return to a tab.
5. Open a website or dialog containing a form. Formly prepares data in the background, including on pages that were already open. Click Formly when you want to fill it.

**Forms appearing prepares data; clicking waits for AI if needed.** Late-rendered forms and forms revealed in dialogs are detected automatically. Hidden tabs wait until visible. Fill shares an existing preload and waits for its response. Missing or expired suggestions are generated before filling. Only a quota/rate-limit error switches to local data; other AI errors leave the form untouched. A request asks for up to ten suggestions for each of up to 30 unknown fields. Recognized fields, custom rules, dropdowns, and radio groups use the local engine. Incomplete or invalid AI results show an error instead of silently filling local values.

Gemini uses your Google project’s quota and billing settings. Formly briefly retries temporary errors while the fill waits. A final quota/rate-limit error enables local fallback for one minute; other failures are reported. Model availability depends on your key; use **Test key** to check access.

### Your cache, your timing

In **Options → Gemini → Suggestion cache**:

| Control | Behavior |
| --- | --- |
| **Cache expiry (minutes)** | Enter a whole number from 1 to 60. Existing installations keep the five-minute default. |
| **Save expiry** | Saves the duration independently of your API key settings. Clears previous suggestions so fresh batches use the new duration. |
| **Clear cache** | Removes all cached suggestions immediately without removing your key or changing your expiry setting. |
| **Cache status** | Shows the number of suggestions and batches, plus a countdown to the next batch expiry. |

Batches are isolated by tab, website origin, language, model, and key. Each field keeps its remaining suggestions when the surrounding form changes. Only new or exhausted fields need another request when background detection runs. Normal typing and unrelated DOM changes do not repeatedly request data. Adding fields does **not** extend the existing batch’s expiry.

Clicks consume suggestions in order. Reloading the same form reuses the remaining batch until it expires. After clearing or expiry, the next eligible page load, form change, or return to the tab prepares a fresh batch. A click uses available cache, waits for an in-flight preload, or requests missing suggestions. Memory is bounded to 24 batches, with up to 120 field signatures per batch.

Suggestions live in session memory. Expiry is checked before filling, and a cleanup alarm removes expired entries. If the browser delays an alarm while sleeping, expired values are still rejected on the next access. Extension reloads, disabling the extension, or a browser restart clear this [session storage](https://developer.chrome.com/docs/extensions/reference/api/storage#property-session).

## Make it fit your forms

### Generator

Choose **English**, **Français**, or **العربية** for generated data. Label recognition always includes all three languages.

Open the settings button at the top of Options to control:

- **Replace existing values** — on by default. Turn it off to preserve populated fields.
- **Fill unknown fields** — on by default. Uses readable fallback values even when the website’s custom validation rejects them.
- **Generate test passwords** — off by default. When enabled, password and confirmation fields share a generated value per fill.

### Custom fields

Add a label and a test value, for example `Project code` → `PRJ-001`. Rules match exact normalized labels, accessible names, names, IDs, or placeholders. Standard autocomplete attributes take priority over label rules. Rules created from the side panel target one field on an exact hostname and take priority over autocomplete. Custom values are inserted exactly as entered, without added prefixes or suffixes. A fixed custom value stays the same across clicks; if it cannot fit the control, that field is reported as incompatible.

### Excluded fields

Search fields and controls inside headers/navigation are skipped by default. Add exclusions using either a label or a CSS selector:

| Match | Example | Scope |
| --- | --- | --- |
| Label, name, ID, or placeholder | `Language` | Exact match with normalized case, accents, punctuation, and Arabic diacritics. |
| CSS field selector | `#site-search` | Excludes matching controls. |
| CSS container selector | `.header-filters` | Excludes the container’s controls too. |
| Optional website | `example.com` | Applies the rule to that hostname and its subdomains. Leave blank for all sites. |

Exclusions save automatically and clear the Gemini cache. Excluded fields keep their values, receive no filling events, and are omitted from Gemini scans. Excluding a radio button protects its whole group.

## Field coverage

| Category | Generated values |
| --- | --- |
| Identity | Username, full / first / middle / last name, date of birth, age, gender, nationality, title |
| Contact & account | Email, phone, website, optional test password |
| Work | Company, job title, department, industry, employee count |
| Address | Street address, apartment / suite, city, state / wilaya, postal code, country |
| Text | Biography, description, message, subject, notes, search text when allowed |
| Numbers | Quantity, price, amount, salary, percentage, rating |
| Dates & appearance | Date, start / end date, time, color |

Native inputs, textareas, selects, checkboxes, and radio groups are supported, including numeric ranges and date/time types. See the [field guide](../FIELD_GUIDE.md) for label aliases and future coverage ideas.

### Freshness and practical limits

Generated fields use readable words and phrases, with no appended random identifiers. Companies, addresses, messages, URLs, and test passphrases rotate through natural samples. Names contain only natural names: `Jamie`, `Parker`, and `Jamie Parker`. Usernames are readable, such as `jamie.parker`, with matching `example.com` emails. Each fill chooses another identity when an alternative is available; the finite name pool can repeat over time. Unknown text inputs use a finite pool of natural words; textareas use short sentences. Dropdowns, radios, bounded numbers, and dates avoid consecutive repeats when an alternative is available. Checkboxes toggle when eligible. Finite choice sets will eventually repeat, and a control with only one allowed value cannot change.

Data is fictional and intended for testing. Emails and websites use `example.com`; phone samples use the fictional US 202-555-01xx range. Address and phone regions are not necessarily tied to the selected language. Website-specific validation may still reject generated data.

Formly works in the active page’s **top-level document**. Frames, shadow DOM, rich-text editors, and custom JavaScript controls need separate adapters. File uploads, hidden/disabled/read-only controls, and detected consent, payment, and one-time-code fields are skipped. Some frameworks require trusted user input that a script cannot reproduce.

## Privacy & permissions

| Data | Where it goes |
| --- | --- |
| Generator settings, custom rules, exclusions | Local extension storage. No browser sync. |
| Gemini API key | Local extension storage restricted to trusted extension pages. It is **not encrypted**. Sent to Google in the API authentication header. |
| Gemini prompt | Field labels/accessibility names, input names/IDs, placeholders, types, constraints, and selected language go to Google. |
| Entered form values | Excluded from the Gemini prompt. Whole-page HTML and page URLs are also excluded. |
| Generated suggestions | Browser session cache, removed on expiry or when you clear it. |

Labels and placeholders are sent as written, so they can contain information specific to the website. **Remove saved key** disables Gemini and clears its cache. No shared API key is bundled, and the development preview does not store Gemini credentials.

Formly requests `activeTab` and `scripting` to fill the clicked page, `storage` for preferences/cache, and `alarms` for cache cleanup. `sidePanel` and `contextMenus` provide the optional page companion. Access to Google’s API endpoint supports Gemini requests. Broad HTTP/HTTPS website access is optional and requested when you enable Gemini’s automatic preparation.

## Development

```sh
npm ci
npm run dev
```

| Local page | Purpose |
| --- | --- |
| `http://127.0.0.1:5187/` | Options preview alongside a working form demo. |
| `http://127.0.0.1:5187/welcome.html` | First-install welcome presentation. |
| `http://127.0.0.1:5187/demo.html` | Standalone form for testing the installed extension. |
| `http://127.0.0.1:5187/dynamic-form.html` | Regression fixture that reveals fields after filling. |

The development webpage previews the interface and local generator. Configure Gemini in the installed extension’s **Options** page.

```sh
npm run build                 # Type-check and create dist/
npm test                      # Unit tests
npx playwright install chromium
npm run test:e2e              # Real Chromium extension + browser UI tests
npm run icons                # Rebuild icon sizes from the generated master
```

Browser tests start a separate server on port 5188 and use disposable profiles. They cover toolbar filling, multilingual data, saved settings, exclusions, changing forms, cache reuse/expiry, and the first-install welcome flow at desktop, tablet, and mobile sizes.

Google responses are simulated in automated tests. The native website-permission dialog and a real Gemini key/model need manual verification. Edge and arbitrary third-party websites are not separately tested.

### Project map

```text
public/manifest.json       Extension permissions, entry points, and icons
../public/icons/              Toolbar and app icons (16–256 px)
src/background.ts          Toolbar action, Gemini preparation, cache, install event
src/engine.ts              Page scanning and form filling
src/data.ts                Synthetic values, settings, field types
src/samples.ts             Readable field samples in English, French, and Arabic
src/gemini.ts              Gemini requests, validation, cache configuration
src/GeminiPanel.tsx         Gemini and cache controls
src/ExclusionsPanel.tsx     Exclusion rules
src/main.tsx               Options and development preview
src/welcome.tsx             First-install welcome presentation
src/welcome.css             Welcome page styling
scripts/build-icons.mjs     Alpha-preserving icon size exports
tests/                      Unit and browser coverage
docs/brand/                 Generated master icon and generation prompt
```

The [implementation history](../PLAN.md) records the project’s evolution. The [icon notes](brand/README.md) include the original generation prompt and how to rebuild the icon sizes.
