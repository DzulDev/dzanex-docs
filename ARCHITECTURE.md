# Dzanex Docs — Full Architecture Guide

> Paste this file into Claude and say: **"Build me this exact app."**
> This document contains everything needed to recreate Dzanex Docs from scratch.

---

## What It Is

A **fully client-side** business document management web app for a small company. No backend server. Generates professional PDF documents (Quotation, Invoice, Purchase Order, Delivery Order) and syncs records to Google Sheets + saves PDFs to Google Drive — all directly from the browser.

**Live example:** https://dzanex-docs.pages.dev/

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + Vite |
| Styling | Tailwind CSS v4 (CSS-first, `@tailwindcss/vite` plugin — no `tailwind.config.js`) |
| PDF generation | `jspdf` + `jspdf-autotable` |
| Date formatting | `date-fns` |
| Icons | `lucide-react` |
| Auth | Google OAuth 2.0 implicit token flow (`window.google.accounts.oauth2`) |
| Storage | Google Sheets API v4 + Google Drive API v3 (direct `fetch`, no SDK) |
| Local config | `localStorage` |
| Routing | React Router v6 |
| Deployment | Cloudflare Pages (auto-deploy from GitHub `main` branch) |
| PWA | `public/manifest.json` + apple-touch-icon + theme-color |

---

## Brand Colors

```
Navy:  #1B3A5C   (primary background, headings)
Teal:  #57A9A9   (active states, accents, PDF table header)
Coral: #E8917A   (secondary accents, SSM number, sign-out)
```

---

## Google Cloud Setup (one-time)

1. Go to https://console.cloud.google.com
2. Create a project
3. Enable **Google Sheets API** and **Google Drive API**
4. Create OAuth 2.0 credentials → Web Application type
5. Add authorised JavaScript origins:
   - `http://localhost:5173` (dev)
   - `https://your-domain.pages.dev` (production)
6. Copy the **Client ID** — it goes in `Login.jsx` as `DEFAULT_CLIENT_ID`
7. OAuth scopes needed:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`

---

## File Structure

```
src/
  pages/
    Login.jsx          — Google OAuth sign-in, Drive folder setup
    Dashboard.jsx      — Status overview, financial summary, action alerts
    DocPage.jsx        — Shared page for all 4 doc types (form + list tabs)
    DocList.jsx        — Document list: table (desktop) / cards (mobile)
    Settings.jsx       — Logo upload, Sheet ID display, company config
  components/
    Layout.jsx         — Sidebar nav, update banner, footer
    DocForm.jsx        — The document creation form
    ItemsTable.jsx     — Line items table with qty, price, bold toggle, notes
  utils/
    google.js          — All Google API calls (Sheets + Drive)
    pdf.js             — All PDF generation (jsPDF)
    company.js         — Company info printed on every PDF
    storage.js         — localStorage helpers (getConfig, saveConfig)
public/
  logo.png             — Company logo (shown in sidebar + PDFs)
  icon-192.png         — PWA icon 192×192
  icon-512.png         — PWA icon 512×512
  apple-touch-icon.png — iOS home screen icon 180×180
  manifest.json        — PWA manifest
  version.json         — Auto-generated at build time for update detection
vite.config.js         — Vite config + buildStart plugin to write version.json
```

---

## Routing

```
/           → Dashboard
/login      → Login
/quotation  → DocPage (Quotation)
/invoice    → DocPage (Invoice)
/po         → DocPage (Purchase Order)
/do         → DocPage (Delivery Order)
/settings   → Settings
```

All routes except `/login` are wrapped in `Layout` (sidebar + header).
Redirect to `/login` if `sheetId` or token is missing.

---

## Authentication Flow

```
Login.jsx
  ↓
signIn(clientId)               — window.google.accounts.oauth2.initTokenClient
  ↓
accessToken stored             — in module memory + localStorage("gtoken")
  ↓
getToken()                     — checks module memory first, then localStorage
  ↓
All API calls use Bearer token  — direct fetch to Google APIs
  ↓
Token expires ~1 hour          — guardFetch() detects 401 → redirect to /login
```

**Token expiry handling:** Every Google API call goes through `guardFetch(res, label)`:
```javascript
async function guardFetch(res, label) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || res.statusText || `HTTP ${res.status}`;
    const err = new Error(`${label}: ${msg}`);
    err.httpStatus = res.status;
    throw err;
  }
  return res;
}
```
Callers check `e.httpStatus === 401` and redirect to login.

---

## localStorage Keys

| Key | Value |
|---|---|
| `gtoken` | Google OAuth access token |
| `dzanex_config` | JSON: `{ clientId, sheetId, driveFolderId, logoDataUrl }` |
| `dzanex_doc_{docNo}` | Raw form JSON for each saved document (local cache fallback) |

---

## Hardcoded Values (change these for your own deployment)

In `Login.jsx`:
```javascript
const DEFAULT_CLIENT_ID = "your-oauth-client-id.apps.googleusercontent.com";
const DEFAULT_SHEET_ID  = "your-google-sheet-id";
```

The `DEFAULT_SHEET_ID` means the app always writes to ONE fixed spreadsheet on every device. No new sheets are ever created. This prevents duplicate spreadsheet confusion.

In `utils/company.js`:
```javascript
export const COMPANY = {
  name:    "Your Company Name",
  regNo:   "Your Registration Number",
  address: "Line 1\nLine 2\nCity, State Postcode",
  phone:   "+60 XX-XXXXXXX",
  email:   "email@yourcompany.com",
  bank:    "Bank Name\nAccount: XXXX-XXXX-XXXX\nAccount Name: Your Name",
};
```

---

## Google Sheets Structure

The spreadsheet has **4 tabs**. Headers are written on first-time setup via `initSheetHeaders()`.

### Quotation / Invoice / PO tabs
```
A: Doc No | B: Date | C: Client | D: Items | E: Subtotal | F: Tax | G: Total | H: Status | I: Drive Link | J: Notes | K: _raw
```

### DO tab
```
A: Doc No | B: Date | C: Client | D: Items | E: Total Qty | F: Status | G: Drive Link | H: Notes | I: _raw
```

The `_raw` column stores the full form JSON (`JSON.stringify(formData)`) — this enables the **Convert** feature to work across different devices.

### Status values per doc type
```
Quotation: Pending | Accepted | Rejected
Invoice:   Pending | Paid | Overdue
PO:        Pending | Received | Cancelled
DO:        Pending | Delivered | Cancelled
```

---

## Google Drive Structure

```
My Drive/
  Dzanex Docs/              ← driveFolderId stored in localStorage
    Quotation/              ← PDFs saved here
    Invoice/
    PO/
    DO/
```

Folders are found-or-created via `ensureDriveFolder(name, parentId, token)` on first login per device.

---

## Document Number Format

```
{PREFIX}-{YEAR}-{SEQ padded to 3}
e.g. QT-2026-001, INV-2026-012, PO-2026-003, DO-2026-007
```

Sequence is counted from existing rows for that year. Resets each year automatically.

---

## DocPage — Shared Component

All 4 doc types use one component, configured by props:

```jsx
<DocPage
  title="Quotation"
  prefix="QT"
  sheetName="Quotation"
  showPrice={true}
  showTax={true}
  showValidUntil={true}   // Quotation only — adds expiry date + T&C section
  partyLabel="Client"     // "Supplier" for PO
  generateFn={generateQuotation}
/>
```

On mount: loads next doc number from Sheets, fires `ensureRawColumn()` to patch old sheets.
On save: generates PDF → uploads to Drive → appends row to Sheets → saves to localStorage.

---

## DocForm Fields

```
date          — Document date (default: today)
validUntil    — Expiry date (Quotation only)
taxRate       — Tax/SST percentage (default: 0)
subject       — Title/heading shown above items table in PDF
paymentTerms  — Payment terms text
notes         — Additional notes/remarks
to: {
  name        — Client/Supplier company name *required
  attn        — Contact person (Attn)
  address     — Full address
  contact     — Phone
  email       — Email
}
items: [{
  description — Item description (can be bold)
  qty         — Quantity
  unit        — Unit ("unit", "pcs", "l/s", etc.)
  unitPrice   — Unit price
  notes       — Sub-description (renders as • bullet lines in PDF)
  isBold      — Bold toggle for main description
}]
terms: [{     — T&C items (Quotation only)
  enabled     — Checkbox on/off
  text        — Editable term text
}]
```

---

## PDF Generation (`utils/pdf.js`)

Each doc type has a generator function: `generateQuotation`, `generateInvoice`, `generatePO`, `generateDO`.

### PDF Page Structure (top to bottom)
```
1. addHeader()         — logo (left) + doc title/number (right) + company info below logo
2. addPartyInfo()      — "To:" section with client/supplier details
3. addSectionTitle()   — bold underlined centered subject/title heading (if provided)
4. addItemsTable()     — jspdf-autotable items table
5. addBankDetails()    — company bank account (Invoice/Quotation)
6. addTerms()          — payment terms box + T&C numbered list
7. addSignature()      — signature lines (Quotation: two-column, Invoice: right-side)
```

### Items Table Styling
- Header row: teal `[87, 169, 169]` background, white text, bold
- Body rows: all white `[255, 255, 255]` — no alternating tint
- Footer row (last page only): light grey `[243, 244, 246]` — "Total Amount: RM X"
- `rowPageBreak: "avoid"` — items never split across pages
- `showFoot: "lastPage"` — Total Amount only on last page
- Bold items: `didDrawCell` hook manually redraws description cell — bold for main line, normal for bullet sub-lines

### Special Rendering
- `isBold` items with `notes`: tracked in `splitBold` map. `didDrawCell` erases auto-render and manually draws bold main + normal bullets
- `unit === "l/s"`: quantity column shows `"l/s"` instead of `"1 l/s"`
- `doc.__taxRate` attached to jsPDF instance before calling `addItemsTable`

---

## DocList — List View

### Desktop (md+): Full table
Columns: all sheet headers (excluding `Drive Link` and `_raw`) + PDF + Convert

### Mobile (below md): Card layout
Each card shows: Doc No, Status badge, Client name, Date, Total/Qty, Items summary (truncated 50 chars), Open PDF button, Convert button

### Status Badge (custom dropdown)
- Replaces native `<select>` — a styled pill button with colored dot + status text + chevron
- Click opens a custom dropdown using `position: fixed` + `getBoundingClientRect()` to escape `overflow: hidden` container
- Transparent backdrop div (`position: fixed, z-40`) closes dropdown on outside click

### Convert Feature
- QT → Invoice or Delivery Order
- INV → Delivery Order
- `getPrefill(row)`: reads `row["_raw"]` (Sheets column) first, falls back to `localStorage`
- Navigates to target route with `{ state: { prefill } }` via React Router
- `DocPage` reads `location.state?.prefill` and passes as `initialData` to `DocForm`

---

## Dashboard

```
Row 1: Financial summary cards
  - Total Docs (all types combined)
  - To Collect (sum of Pending + Overdue invoices with count)
  - Paid This Month (sum of Paid invoices where date starts with current YYYY-MM)

Row 2: Action alerts (only shown when count > 0, sorted by urgency)
  - 🔴 Overdue invoices — most urgent
  - 🟠 Unpaid invoices + MYR total
  - 🟡 Pending quotations awaiting response
  - 🔵 Pending delivery orders
  Each alert is a clickable button → navigates to that doc list

Row 3: Status breakdown grid (2×2)
  Each card: doc type name + icon + total count
  Status rows: colored dot + status name + count (greyed if zero)
  Click → navigates to that doc list

Row 4: Recent 5 docs
  Across all types, sorted by date desc
  Shows: Doc No, type badge, client, date, amount, status dot
```

---

## Layout Component

### Sidebar
```
Navy (#1B3A5C) background
├── Company logo + name (teal) + reg number (coral)
├── Nav links
│   Active:   teal (#57A9A9) pill background, white text, white icon
│   Inactive: white/60 text, teal-tinted icon
│   Hover:    white/8 background, white text
└── Sign out button (coral accent)
```

### Update Detection Banner
- `vite.config.js` writes `public/version.json` with `{ version, buildTime: Date.now() }` on `buildStart`
- Layout polls `/version.json?t=${Date.now()}` every 60 seconds
- On first load: saves `currentBuildTime` as baseline
- If `buildTime` changes: shows teal banner "New update available!"
- Banner has "Refresh now" button + auto-refreshes after 20 seconds

### Mobile Header
- Below `lg` breakpoint: sidebar is hidden, hamburger menu button shows in top header
- Sidebar slides in as overlay with dark backdrop

### Footer
```
© 2025 Dzanex Technology    v{version}
```
Version pulled from `package.json`. Year hardcoded as 2025 (company founding year).

---

## PWA Setup

```html
<!-- index.html -->
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#1B3A5C">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Dzanex Docs">
```

```json
// public/manifest.json
{
  "name": "Dzanex Docs",
  "short_name": "Dzanex Docs",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1B3A5C",
  "theme_color": "#1B3A5C",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Generate `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180×180) from an SVG using `sharp`.

---

## vite.config.js

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { writeFileSync } from "fs";
import { readFileSync } from "fs";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "version-json",
      buildStart() {
        const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
        writeFileSync("public/version.json", JSON.stringify({
          version: pkg.version,
          buildTime: Date.now(),
        }));
      },
    },
  ],
});
```

---

## Tailwind CSS Setup

```css
/* src/index.css */
@import "tailwindcss";

@layer components {
  .label {
    @apply block text-xs font-medium text-gray-600 mb-1;
  }
  .input {
    @apply w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800
           focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent;
  }
}
```

---

## Shared CSS Utilities

| Class | Usage |
|---|---|
| `.label` | Form field label |
| `.input` | Text input, textarea, select |

---

## Key Design Decisions

1. **No backend** — everything runs in the browser. Google OAuth implicit flow gives a token directly to the frontend. APIs are called with `fetch`.

2. **Single sheet ID hardcoded** — prevents duplicate spreadsheets when logging in from different devices. One company = one sheet.

3. **`_raw` column in Sheets** — stores full form JSON so the Convert feature works cross-device without relying on localStorage.

4. **`position: fixed` dropdowns** — custom status and convert dropdowns use `getBoundingClientRect()` + `position: fixed` to escape `overflow: hidden` table containers. A transparent backdrop div closes them on outside click.

5. **`guardFetch()` pattern** — all Google API calls throw a typed error on failure with `err.httpStatus`. 401 anywhere → redirect to login. Prevents silent failures where the app shows "Saved!" but nothing was actually written.

6. **`doc.__taxRate` hack** — attaches taxRate directly to the jsPDF instance so `addItemsTable` can access it without changing its function signature.

7. **`ensureRawColumn()` migration** — fire-and-forget on every page load. Adds `_raw` header to any existing sheet tab that predates the column.

---

## Deployment (Cloudflare Pages)

1. Push code to GitHub
2. Connect repo to Cloudflare Pages
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add your production domain to Google Cloud Console → OAuth → Authorised JavaScript origins
6. Every push to `main` triggers an auto-deploy

---

## Dependencies (package.json)

```json
"dependencies": {
  "date-fns": "^X.X.X",
  "jspdf": "^X.X.X",
  "jspdf-autotable": "^X.X.X",
  "lucide-react": "^X.X.X",
  "react": "^19.X.X",
  "react-dom": "^19.X.X",
  "react-router-dom": "^6.X.X"
},
"devDependencies": {
  "@tailwindcss/vite": "^4.X.X",
  "@vitejs/plugin-react": "^X.X.X",
  "tailwindcss": "^4.X.X",
  "vite": "^X.X.X",
  "eslint": "^X.X.X"
}
```

Also add to `index.html` (Google Identity Services, loaded before app):
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```
