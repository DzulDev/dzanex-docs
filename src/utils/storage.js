// Local config stored in localStorage (clientId, sheetId, Drive root folder)
export const CONFIG_KEY = "dzanex_config";

export function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveConfig(updates) {
  const existing = getConfig();
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...existing, ...updates }));
}
