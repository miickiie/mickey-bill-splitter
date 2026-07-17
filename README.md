# Mickey Bill Splitter

A mobile-focused restaurant bill splitter for groups. The app helps track each person's items, shared discounts, individual discounts, service charge, VAT, Sushiro plate totals, receipt-scanned items, and PromptPay collection amounts.

The app is a browser-only React/Vite application. It stores bill state locally in the browser and can be deployed as a static site, including GitHub Pages.

## What It Does

- Add, rename, and remove people on the bill.
- Add manual items per person.
- Split scanned receipt quantities into individual items when needed.
- Apply a shared discount as a fixed amount or percentage.
- Apply individual discounts to specific people.
- Toggle 10% service charge.
- Toggle 7% VAT.
- Enable Sushiro plate counting with fixed plate prices.
- Scan receipt images with Gemini and import detected items.
- Copy a formatted bill summary to the clipboard.
- Generate a PromptPay QR code for a selected person's total.
- Copy or download the generated QR code.
- Switch between Thai and English.
- Switch light/dark theme.
- Persist bill, theme, and PromptPay ID in browser localStorage.

## Tech Stack

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4 through `@tailwindcss/vite`
- `motion` for UI animation
- `lucide-react` for icons
- `canvas-confetti` for completion feedback
- `i18next` and `react-i18next` for Thai/English localization
- `@google/genai` for receipt scanning
- `promptpay-qr` and `qrcode.react` for PromptPay QR generation

`express`, `dotenv`, and `tsx` are installed, but there is currently no backend entrypoint or package script using them. The current app behavior is client-side only.

## Main Workflows

### Manual Bill Splitting

1. Add everyone who is sharing the bill.
2. Add each person's items and prices.
3. Add individual discounts if someone has a personal discount.
4. Add a shared discount if the whole table received one.
5. Toggle service charge and VAT based on the receipt.
6. Review each person's calculated total.
7. Copy the bill summary or open the PromptPay QR view.

### Sushiro Mode

Sushiro mode adds plate counters to each person. Plate totals are included in the bill subtotal.

| Plate color | Price |
| --- | ---: |
| White | 30 |
| Red | 40 |
| Silver | 60 |
| Gold | 80 |
| Black | 100 |

### Receipt Scanning

Receipt scanning reads an uploaded image in the browser, converts it to base64, and sends it to Gemini for item extraction. The detected items can then be imported into the bill.

The scanner uses the `gemini-3.5-flash` model through `@google/genai`.

### PromptPay QR

The QR view lets you enter a PromptPay ID, choose a member, and generate a QR code for that member's calculated total. The PromptPay ID is stored in localStorage for convenience.

The app strips non-digits before generating the PromptPay payload. It does not currently enforce PromptPay ID length or type validation before payload generation.

## Calculation Rules

The calculation flow is:

1. Sum all manual item prices.
2. If Sushiro mode is enabled, add each person's plate totals.
3. Apply individual discounts to each person.
4. Calculate shared discount:
   - percentage discount is based on subtotal
   - fixed discount uses the entered amount
5. Split the shared discount equally across people.
6. Clamp each person's discounted base at zero.
7. Apply 10% service charge to the post-discount total when enabled.
8. Apply 7% VAT to the post-discount total plus service charge when enabled.
9. Allocate the final grand total back to people proportionally with `grandTotal / totalBase`.

Important behavior:

- Shared discounts are split equally, not proportionally by spending.
- Individual discounts are applied before service charge and VAT.
- If discounts reduce a person's base below zero, that person's base is clamped to zero.
- VAT is calculated after service charge.

## Local Storage

The app persists state in the browser with these keys:

- `bill-splitter-state-v2`
- `bill-splitter-theme`
- `bill-splitter-promptpay-id`

Clearing bill data resets the people and bill settings. Theme and PromptPay ID are stored separately.

## Environment Variables

Receipt scanning needs a Gemini API key:

```bash
GEMINI_API_KEY=your_gemini_api_key
```

For local development, put this in `.env.local`.

Codex did not inspect any `.env` or `.env*` files. Do not commit `.env.local` or real API keys.

### Security Note

This project injects `GEMINI_API_KEY` into the Vite frontend bundle as `process.env.GEMINI_API_KEY`. That means the key should be treated as exposed to anyone who can load the built site.

This is acceptable for a private prototype only if the key is restricted and disposable. For a public or production deployment, move Gemini calls behind a backend endpoint and keep the real key server-side.

## Getting Started

### Requirements

- Node.js 24 is used by the GitHub Pages workflow.
- npm, using the checked-in `package-lock.json`.

### Install

```bash
npm ci
```

`npm install` also works for local dependency installation, but `npm ci` matches the deploy workflow and gives reproducible installs from `package-lock.json`.

### Run Locally

```bash
npm run dev
```

The dev server runs Vite on:

```text
http://localhost:3000
```

The configured command is:

```bash
vite --port=3000 --host=0.0.0.0
```

### Type Check

```bash
npm run lint
```

Despite the script name, this currently runs TypeScript checking only:

```bash
tsc --noEmit
```

There is no separate ESLint configuration found in this repo.

### Build

```bash
npm run build
```

The production output is written to `dist`.

### Preview Production Build

```bash
npm run preview
```

### Clean Build Output

```bash
npm run clean
```

This removes `dist`.

## Deployment

The repo includes a GitHub Pages workflow at `.github/workflows/deploy.yml`.

The workflow:

- runs on pushes to `main` or `master`
- can be triggered manually with `workflow_dispatch`
- uses Node.js 24
- installs dependencies with `npm ci`
- builds with `npm run build`
- uploads `dist`
- deploys to GitHub Pages

For receipt scanning in the deployed build, configure a GitHub Actions secret named:

```text
GEMINI_API_KEY
```

Remember that this key is still bundled into the static frontend build. Use a restricted key or move receipt scanning behind a backend before treating the deployment as production-safe.

`vite.config.ts` uses `base: './'`, which helps static hosting paths such as GitHub Pages.

## Project Structure

```text
.
|-- .github/workflows/deploy.yml   # GitHub Pages deployment workflow
|-- index.html                     # Vite HTML entry, favicon, Telegram WebApp script
|-- metadata.json                  # App metadata
|-- package.json                   # npm scripts and dependencies
|-- package-lock.json              # Locked npm dependency tree
|-- public
|   `-- favicon.svg                # Browser tab icon
|-- src
|   |-- App.tsx                    # Main UI, state, calculations, QR workflow
|   |-- i18n.ts                    # Thai/English translation setup
|   |-- index.css                  # Tailwind import and global styles
|   |-- main.tsx                   # React entrypoint
|   `-- services
|       `-- receiptScanner.ts      # Gemini receipt extraction client
|-- tsconfig.json                  # TypeScript config
`-- vite.config.ts                 # Vite config and env injection
```

## Source Notes

- There is no React router. The app switches between the main bill view and QR view with local React state.
- Most UI and calculation behavior lives in `src/App.tsx`.
- Thai is the default language, with English fallback.
- Google Fonts are imported from CSS.
- `index.html` includes the Telegram WebApp script, but there is no separate backend integration in this repo.

## Testing Status

There is currently no `test` script and no Vitest, Jest, Playwright, or other test setup found in the repo.

Available verification today:

```bash
npm run lint
npm run build
```

## Known Limitations

- The app is client-only, so Gemini receipt scanning exposes the configured key in the built frontend.
- PromptPay ID input is normalized to digits, but not fully validated before QR payload generation.
- Number inputs do not consistently enforce minimum values.
- Shared discounts can exceed subtotal; calculated per-person bases are clamped at zero.
- Receipt quantity handling depends on the quantity returned by Gemini and does not enforce integer-only quantities in the UI layer.
- Shared discounts are split equally, which may not match every group's expectation.

## Recommended Next Improvements

1. Move Gemini receipt scanning behind a backend API.
2. Add PromptPay ID validation for phone, national ID, or e-wallet formats.
3. Add unit tests for bill calculation edge cases.
4. Add end-to-end tests for the main split flow and QR flow.
5. Extract calculation logic from `src/App.tsx` into a pure utility module.
6. Rename `npm run lint` or add real ESLint so the script name matches what it does.
