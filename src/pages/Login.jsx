import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signIn } from "../utils/google";
import { getConfig, saveConfig } from "../utils/storage";
import { createSpreadsheet, initSheetHeaders, ensureDriveFolder } from "../utils/google";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [clientId, setClientId] = useState(getConfig().clientId || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleLogin() {
    if (!clientId.trim()) return setError("Paste your Google OAuth Client ID.");
    saveConfig({ clientId });
    setLoading(true);
    setError("");
    try {
      const token = await signIn(clientId.trim());
      let { sheetId, driveFolderId } = getConfig();

      if (!sheetId) {
        sheetId = await createSpreadsheet(token);
        await initSheetHeaders(sheetId, token);
        saveConfig({ sheetId });
      }

      if (!driveFolderId) {
        const rootId = await ensureDriveFolder("Dzanex Docs", null, token);
        await Promise.all([
          ensureDriveFolder("Quotation", rootId, token),
          ensureDriveFolder("Invoice", rootId, token),
          ensureDriveFolder("PO", rootId, token),
          ensureDriveFolder("DO", rootId, token),
        ]);
        saveConfig({ driveFolderId: rootId });
      }

      navigate("/");
    } catch (e) {
      setError("Sign-in failed. Check your Client ID and try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Dzanex Technology" className="w-28 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-gray-800">Dzanex Docs</h1>
          <p className="text-gray-500 text-sm mt-1">Document Management System</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Google OAuth Client ID</label>
            <input
              className="input font-mono text-xs"
              placeholder="xxxxxxx.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Paste your Client ID from Google Cloud Console → APIs & Services → Credentials
            </p>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white py-3 rounded-xl font-semibold hover:bg-blue-800 disabled:opacity-60 transition-colors"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#4285F4" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? "Setting up…" : "Sign in with Google"}
          </button>
        </div>

        <div className="mt-6 p-4 bg-amber-50 rounded-xl text-xs text-amber-800 space-y-1">
          <p className="font-semibold">First-time setup?</p>
          <p>1. Go to <span className="font-mono">console.cloud.google.com</span></p>
          <p>2. Create a project → Enable Sheets API + Drive API</p>
          <p>3. Create OAuth 2.0 credentials (Web app type)</p>
          <p>4. Add <span className="font-mono">http://localhost:5173</span> to Authorised JS origins</p>
          <p>5. Paste the Client ID above</p>
        </div>
      </div>
    </div>
  );
}
