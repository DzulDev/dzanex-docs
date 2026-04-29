# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deployment

Live URL: **https://dzanex-docs.pages.dev/** (Cloudflare Pages — auto-deploys from `main` branch)
GitHub: **https://github.com/DzulDev/dzanex-docs**

## Commands

```bash
npm run dev       # start dev server at http://localhost:5173
npm run build     # production build to dist/
npm run lint      # ESLint (no --fix flag; fix manually)
npm run preview   # preview the production build
```

There is no test suite.

## Document Workflow

**Quotation → Invoice → Delivery Order** (PO is optional, sent to supplier not client)

1. **QT** — Sent to client before work. They approve or reject.
2. **INV** — Sent after client agrees. Requests payment.
3. **PO** — Dzanex buys materials from a supplier. Not always needed.
4. **DO** — Delivery confirmation. Client signs to acknowledge receipt.

Quotation is always first. Not every job needs all 4.

## Architecture

**Dzanex Docs** is a fully client-side document management system for generating business PDFs (Quotation, Invoice, Purchase Order, Delivery Order) and syncing records to Google Sheets/Drive. There is no backend — all API calls go directly from the browser.

### Auth & Config

- Google OAuth 2.0 (implicit token flow via `window.google.accounts.oauth2`)
- Token stored in both module memory (`accessToken`) and `localStorage("gtoken")` — `getToken()` checks both
- Tokens expire after ~1 hour. All key API calls use `guardFetch()` in `utils/google.js` — throws on non-OK responses with `err.httpStatus`. A 401 anywhere redirects to `/login`
- All app config (`clientId`, `sheetId`, `driveFolderId`, `logoDataUrl`) stored in `localStorage("dzanex_config")` via `utils/storage.js`
- **Sheet ID is hardcoded** as `DEFAULT_SHEET_ID` in `Login.jsx` — the app always uses `15cIdmWjr8_PtJVZPRQM4KrpRgU1EKjIbc7A3h_0sPPE` on every device. No new spreadsheets are ever created.
- On first login per device, `Login.jsx` finds/creates the Drive folder hierarchy (`Dzanex Docs/` → `Quotation/`, `Invoice/`, `PO/`, `DO/`) and saves the root folder ID to localStorage

### One Component for All 4 Doc Types

`DocPage` is the single page component shared by all document routes. It receives props that configure its behaviour:

| Prop | Controls |
|---|---|
| `prefix` | Doc number prefix (QT, INV, PO, DO) |
| `sheetName` | Which Google Sheet tab to read/write |
| `showPrice` / `showTax` | Whether to show pricing columns |
| `showValidUntil` | Quotation-only expiry date field |
| `partyLabel` | "Client" vs "Supplier" label |
| `generateFn` | PDF generation function from `utils/pdf.js` |

`DocPage` → `DocForm` → `ItemsTable` is the form hierarchy. `DocList` is the second tab within `DocPage` for browsing existing records.

### DocList — Document List View

- **Desktop (md+):** full table with all columns
- **Mobile (below md):** card layout — one card per doc showing Doc No, client, date, amount, items summary, status badge, Open PDF + Convert buttons
- **Status dropdown:** custom pill badge (not native `<select>`) with colored dot + chevron. Renders with `position: fixed` using `getBoundingClientRect()` to escape `overflow: hidden` clipping
- **Convert dropdown:** same fixed-position approach. Only shown for QT (→ Invoice, → DO) and INV (→ DO)
- Both dropdowns share a transparent backdrop overlay (`position: fixed, z-40`) that closes them on outside click
- `getPrefill(row)` reads `row["_raw"]` (Google Sheets column) first, falls back to `localStorage` — enables cross-device Convert

### Dashboard

- **Financial summary row:** total docs, amount to collect (pending + overdue invoices), paid this month
- **Action alerts:** clickable banners for overdue invoices, unpaid invoices, pending quotations, pending DOs — sorted by urgency, only shown when count > 0
- **Status breakdown grid (2×2):** one card per doc type showing count per status with colored dots; greyed out when zero; click navigates to that list
- **Recent 5 docs:** across all types, sorted by date, with status indicator

### PDF Generation

All PDF rendering is client-side via `jsPDF` + `jspdf-autotable` in `utils/pdf.js`.

- Company details come from `utils/company.js` — edit this file to change company info on all PDFs
- Logo is preloaded from `public/logo.png` into `localStorage` as a base64 data URL at app startup (`App.jsx`) so it's available synchronously when `generateFn` is called
- Each item has a `notes` field used for sub-descriptions that render as indented bullet points (`  • line`) inside the description cell of the table
- For l/s (lump sum) items: set `unit = "l/s"` — the PDF Quantity column will show `"l/s"` instead of `"1 l/s"`
- `doc.__taxRate` is attached directly to the jsPDF instance so `addItemsTable` can access it without changing its signature
- Table body rows are all white (`bodyStyles: { fillColor: [255,255,255] }`) — no alternating tint. Teal header only.
- `didDrawCell` hook handles bold-main + normal-bullets split rendering per cell

### Google Sheets Row Format

Sheet columns are defined in the `HEADERS` object in `utils/google.js`. The Sheets API is called directly with fetch — no SDK.

- Doc number format: `${prefix}-${year}-${seq padded to 3}` — sequence resets per year, counted from existing rows
- Rows are appended via `valueInputOption=USER_ENTERED`
- `_raw` column (last column on every sheet) stores the full form JSON — enables cross-device Convert feature
- `ensureRawColumn()` fire-and-forgets on every DocPage load to patch older sheets that lack the `_raw` column

### Styling

- Tailwind v4 (CSS-first, configured via `@tailwindcss/vite` plugin — no `tailwind.config.js`)
- Two shared CSS utilities defined as Tailwind components in `src/index.css`: `.label` and `.input`
- Brand colours: navy `#1B3A5C`, teal `#57A9A9`, coral `#E8917A`
- Sidebar: navy bg, teal active pill, coral for SSM number + sign-out button, teal-tinted icons when inactive
