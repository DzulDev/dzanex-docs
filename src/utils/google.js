const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

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

let tokenClient = null;
let accessToken = null;

export function initGoogleAuth(clientId) {
  return new Promise((resolve) => {
    window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        accessToken = response.access_token;
        resolve(response.access_token);
      },
    });
    resolve(null);
  });
}

export function signIn(clientId) {
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) return reject(response.error);
        accessToken = response.access_token;
        localStorage.setItem("gtoken", response.access_token);
        resolve(response.access_token);
      },
    });
    tokenClient.requestAccessToken();
  });
}

export function getToken() {
  return accessToken || localStorage.getItem("gtoken");
}

export function signOut() {
  accessToken = null;
  localStorage.removeItem("gtoken");
  localStorage.removeItem("gsheetId");
}

// ── Sheets ────────────────────────────────────────────────────────────────────

export async function ensureSheet(sheetId, token) {
  const t = token || getToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,
    { headers: { Authorization: `Bearer ${t}` } }
  );
  return res.ok;
}

export async function createSpreadsheet(token) {
  const t = token || getToken();
  const sheets = ["Quotation", "Invoice", "PO", "DO", "PV"].map((title) => ({
    properties: { title },
  }));
  const body = {
    properties: { title: "Dzanex Docs - Record Documents" },
    sheets,
  };
  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data.spreadsheetId;
}

const HEADERS = {
  Quotation: ["Doc No", "Date", "Client", "Items", "Subtotal", "Tax", "Total", "Status", "Drive Link", "Notes", "_raw"],
  Invoice:   ["Doc No", "Date", "Client", "Items", "Subtotal", "Tax", "Total", "Status", "Drive Link", "Notes", "_raw"],
  PO:        ["Doc No", "Date", "Supplier", "Items", "Subtotal", "Tax", "Total", "Status", "Drive Link", "Notes", "_raw"],
  DO:        ["Doc No", "Date", "Client", "Items", "Total Qty", "Status", "Drive Link", "Notes", "_raw"],
  PV:        ["Doc No", "Date", "Paid To", "Purpose", "Amount", "Status", "Drive Link", "Notes", "_raw"],
};

export async function initSheetHeaders(sheetId, token) {
  const t = token || getToken();
  const requests = Object.entries(HEADERS).map(([sheet, headers]) => ({
    range: `${sheet}!A1`,
    values: [headers],
  }));
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ valueInputOption: "RAW", data: requests }),
    }
  );
}

export async function appendRow(sheetId, sheetName, row, token) {
  const t = token || getToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    }
  );
  await guardFetch(res, "appendRow");
}

export async function getRows(sheetId, sheetName, token) {
  const t = token || getToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A1:Z`,
    { headers: { Authorization: `Bearer ${t}` } }
  );
  await guardFetch(res, "getRows");
  const data = await res.json();
  const [headers, ...rows] = data.values || [[]];
  if (!headers) return [];
  return rows.map((r, i) => ({
    ...Object.fromEntries(headers.map((h, j) => [h, r[j] ?? ""])),
    _rowNum: i + 2, // sheet row number (1 = headers, data starts at 2)
  }));
}

// Adds "_raw" header column to existing sheets that don't have it yet
export async function ensureRawColumn(sheetId, token) {
  const t = token || getToken();
  for (const sheetName of Object.keys(HEADERS)) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!1:1`,
        { headers: { Authorization: `Bearer ${t}` } }
      );
      const data = await res.json();
      const existing = data.values?.[0] || [];
      if (existing.includes("_raw")) continue;
      const col = String.fromCharCode(64 + existing.length + 1);
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!${col}1?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [["_raw"]] }),
        }
      );
    } catch { /* skip */ }
  }
}

export async function updateCell(sheetId, sheetName, rowNum, col, value, token) {
  const t = token || getToken();
  const range = `${sheetName}!${col}${rowNum}`;
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[value]] }),
    }
  );
}

export async function getSheetGid(sheetId, sheetName, token) {
  const t = token || getToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${t}` } }
  );
  await guardFetch(res, "getSheetGid");
  const data = await res.json();
  const sheet = data.sheets?.find(s => s.properties.title === sheetName);
  return sheet?.properties?.sheetId ?? 0;
}

export async function deleteSheetRow(sheetId, sheetGid, rowNum, token) {
  const t = token || getToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetGid,
              dimension: "ROWS",
              startIndex: rowNum - 1,
              endIndex: rowNum,
            },
          },
        }],
      }),
    }
  );
  await guardFetch(res, "deleteSheetRow");
}

export async function deleteDriveFile(driveLink, token) {
  const t = token || getToken();
  const fileId = driveLink?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!fileId) return;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${t}` } }
  );
  if (!res.ok) await guardFetch(res, "deleteDriveFile");
}

export async function getNextDocNumber(sheetId, sheetName, prefix, token) {
  const rows = await getRows(sheetId, sheetName, token);
  const year = new Date().getFullYear();
  const thisYear = rows.filter((r) =>
    (r["Doc No"] || "").startsWith(`${prefix}-${year}`)
  );
  const seq = thisYear.length + 1;
  return `${prefix}-${year}-${String(seq).padStart(3, "0")}`;
}

export async function ensureSheetExists(sheetId, sheetName, token) {
  const t = token || getToken();
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${t}` } }
    );
    const data = await res.json();
    const exists = data.sheets?.some(s => s.properties.title === sheetName);
    if (exists) return;
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
    });
    const headers = HEADERS[sheetName];
    if (headers) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A1?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [headers] }),
        }
      );
    }
  } catch { /* skip */ }
}

// ── Drive ─────────────────────────────────────────────────────────────────────

export async function ensureDriveFolder(name, parentId, token) {
  const t = token || getToken();
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentId ? ` and '${parentId}' in parents` : ""}`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${t}` } }
  );
  const data = await res.json();
  if (data.files?.length) return data.files[0].id;
  const body = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) body.parents = [parentId];
  const create = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  await guardFetch(create, "ensureDriveFolder");
  const folder = await create.json();
  return folder.id;
}

export async function uploadPDF(pdfBytes, filename, folderId, token) {
  const t = token || getToken();
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: "application/pdf",
  };
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }));
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
      body: form,
    }
  );
  await guardFetch(res, "uploadPDF");
  const data = await res.json();
  return data.webViewLink || (data.id ? `https://drive.google.com/file/d/${data.id}/view` : null);
}
