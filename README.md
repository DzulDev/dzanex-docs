# Dzanex Docs

Internal document management system for **Dzanex Technology** — generate, save, and manage business documents (Quotation, Invoice, Purchase Order, Delivery Order) with PDF export and Google Drive storage.

---

## How It Works

```
You fill a form → PDF is generated → PDF saved to Google Drive → Record saved to Google Sheets
```

All data lives in **your own** Google account. No external server or database.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS v4 |
| PDF generation | jsPDF + jsPDF-AutoTable |
| Auth | Google OAuth 2.0 (via GSI client) |
| Database | Google Sheets API |
| File storage | Google Drive API |
| Routing | React Router v7 |

---

## Features

- **Quotation** — with Terms & Conditions, 80% deposit auto-calculated
- **Invoice** — with payment details and bank info
- **Purchase Order** — with approval signature block
- **Delivery Order** — with received/delivered signature blocks
- **Dashboard** — summary counts + recent documents table
- **PDF Preview** — preview before saving
- **Google Drive** — PDFs auto-saved to organised folders
- **Google Sheets** — every saved document logged as a row
- **Logo upload** — upload company logo via Settings, appears on all PDFs
- **Auto doc numbering** — QT-2026-001, INV-2026-001, PO-2026-001, DO-2026-001

---

## First-Time Setup

### 1. Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project — e.g. `Dzanex Docs`
3. Enable these APIs: **Google Sheets API** and **Google Drive API**
4. Go to **APIs & Services → OAuth consent screen**
   - User type: External
   - Fill in app name and your email
   - Add your Gmail as a **Test User**
5. Go to **Credentials → + Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorised JavaScript origins: `http://localhost:5173`
   - Copy the **Client ID**

### 2. Run the app

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, paste your Client ID, click **Sign in with Google**.

On first login the app automatically:
- Creates a Google Sheet called `Dzanex Docs — Records` in your Drive
- Creates a `Dzanex Docs` folder in Drive with subfolders (Quotation, Invoice, PO, DO)

---

## Project Structure

```
src/
├── pages/
│   ├── Login.jsx         # Google OAuth login + first-time setup
│   ├── Dashboard.jsx     # Stats cards + recent documents
│   ├── DocPage.jsx       # Generic page: new doc form + list tab
│   ├── DocList.jsx       # Reads and displays rows from Google Sheets
│   └── Settings.jsx      # Logo upload + connected resource info
├── components/
│   ├── Layout.jsx        # Sidebar navigation
│   ├── DocForm.jsx       # Document form (date, client info, items)
│   └── ItemsTable.jsx    # Line items with add/remove rows
└── utils/
    ├── google.js         # Google OAuth, Sheets API, Drive API
    ├── pdf.js            # PDF generators for all 4 document types
    ├── company.js        # Dzanex Technology company info
    └── storage.js        # localStorage helpers
```

---

## Document Numbering

| Type | Format | Example |
|---|---|---|
| Quotation | QT-YYYY-NNN | QT-2026-001 |
| Invoice | INV-YYYY-NNN | INV-2026-001 |
| Purchase Order | PO-YYYY-NNN | PO-2026-001 |
| Delivery Order | DO-YYYY-NNN | DO-2026-001 |

Numbers auto-increment per year based on existing rows in Google Sheets.

---

## Google Sheets Structure

| Sheet | Columns |
|---|---|
| Quotation | Doc No, Date, Client, Items, Subtotal, Tax, Total, Status, Drive Link, Notes |
| Invoice | Doc No, Date, Client, Items, Subtotal, Tax, Total, Status, Drive Link, Notes |
| PO | Doc No, Date, Supplier, Items, Subtotal, Tax, Total, Status, Drive Link, Notes |
| DO | Doc No, Date, Client, Items, Total Qty, Status, Drive Link, Notes |

---

## Company Info

Edit `src/utils/company.js` to update details that appear on all PDFs:

```js
export const COMPANY = {
  name: "Dzanex Technology",
  regNo: "TR0320764-P",
  address: "...",
  phone: "+6011 1888 0307",
  email: "dzanextechnology@gmail.com",
  bank: "Maybank",
  bankAccount: "568621091345",
  bankAccountName: "DZANEX TECHNOLOGY",
};
```

---

## Commands

```bash
npm run dev       # start dev server at localhost:5173
npm run build     # production build to dist/
npm run preview   # preview production build
npm run lint      # run ESLint
```
