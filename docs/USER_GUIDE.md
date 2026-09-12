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

## Gemini (optional)

Local generation works without an account or API key. To add contextual suggestions:

1. Open **Options → Gemini** and enter your key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Click **Test key** to check which supported models your key can reach. This lists models; it does not generate test data.
3. Enable **Use Gemini for unknown fields**, then click **Save settings**.
4. Accept the browser’s website-access request. This lets Formly prepare suggestions automatically when websites load or reload.
5. Reload a website with a form, then click Formly when you want to fill it.

**Reloading prepares data; clicking fills the form.** A request asks for up to ten suggestions for each of up to 30 unknown fields. Recognized fields, custom rules, dropdowns, and radio groups use the local engine. Unanswered fields or failed requests fall back to local data.

Gemini uses your Google project’s quota and billing settings. Formly briefly retries temporary errors before falling back. Model availability depends on your key; use **Test key** to check access.

### Your cache, your timing

In **Options → Gemini → Suggestion cache**:

| Control | Behavior |
| --- | --- |
| **Cache expiry (minutes)** | Enter a whole number from 1 to 60. Existing installations keep the five-minute default. |
| **Save expiry** | Saves the duration independently of your API key settings. Clears previous suggestions so fresh batches use the new duration. |
| **Clear cache** | Removes all cached suggestions immediately without removing your key or changing your expiry setting. |
| **Cache status** | Shows the number of suggestions and batches, plus a countdown to the next batch expiry. |

Batches are isolated by tab, website origin, language, model, and key. Each field keeps its remaining suggestions when the surrounding form changes. Only new or exhausted fields need another request. Adding fields does **not** extend the existing batch’s expiry.

Clicks consume suggestions in order. Reloading the same form reuses the remaining batch until it expires. After clearing or expiry, the next eligible page load or toolbar click prepares a fresh batch. Memory is bounded to 24 batches, with up to 120 field signatures per batch.

Suggestions live in session memory. Expiry is checked before filling, and a cleanup alarm removes expired entries. If the browser delays an alarm while sleeping, expired values are still rejected on the next access. Extension reloads, disabling the extension, or a browser restart clear this [session storage](https://developer.chrome.com/docs/extensions/reference/api/storage#property-session).

## Make it fit your forms

### Generator

Choose **English**, **Français**, or **العربية** for generated data. Label recognition always includes all three languages.

Open the settings button at the top of Options to control:

- **Replace existing values** — on by default. Turn it off to preserve populated fields.
- **Fill unknown fields** — on by default. Uses readable fallback values even when the website’s custom validation rejects them.
- **Generate test passwords** — off by default. When enabled, password and confirmation fields share a generated value per fill.

### Custom fields

Add a label and a test value, for example `Project code` → `PRJ-001`. Rules match exact normalized labels, accessible names, names, IDs, or placeholders. Standard autocomplete attributes take priority. Custom values are inserted exactly as entered, without added prefixes or suffixes. A fixed custom value stays the same across clicks; if it cannot fit the control, that field is reported as incompatible.

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

Formly requests `activeTab` and `scripting` to fill the clicked page, `storage` for preferences/cache, and `alarms` for cache cleanup. Access to Google’s API endpoint supports Gemini requests. Broad HTTP/HTTPS website access is optional and requested when you enable Gemini’s automatic preparation.

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
