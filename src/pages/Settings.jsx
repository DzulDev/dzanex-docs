import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Trash2, LogOut } from "lucide-react";
import { getConfig, saveConfig } from "../utils/storage";
import { signOut } from "../utils/google";

export default function Settings() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(getConfig());

  function handleLogo(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      saveConfig({ logoDataUrl: reader.result });
      setConfig(getConfig());
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    saveConfig({ logoDataUrl: null });
    setConfig(getConfig());
  }

  function handleSignOut() {
    signOut();
    navigate("/login");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Settings</h1>

      {/* Logo */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-700">Company Logo</h2>
          <p className="text-xs text-gray-400 mt-0.5">Shown on all generated PDFs.</p>
        </div>
        {config.logoDataUrl ? (
          <div className="flex items-center gap-4">
            <img src={config.logoDataUrl} alt="Logo" className="h-16 object-contain border border-gray-200 rounded p-1 bg-gray-50" />
            <button onClick={removeLogo}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700">
              <Trash2 size={14} /> Remove
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 cursor-pointer w-fit px-4 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
            <Upload size={15} />
            Upload Logo (PNG / JPG)
            <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
          </label>
        )}
      </div>

      {/* Connected resources */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-700">Connected Resources</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-gray-500 shrink-0">Google Sheets ID:</span>
            <span className="font-mono text-xs text-blue-700 break-all">{config.sheetId || "—"}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-500 shrink-0">Drive Folder ID:</span>
            <span className="font-mono text-xs text-blue-700 break-all">{config.driveFolderId || "—"}</span>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Account</h2>
        <button onClick={handleSignOut}
          className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800 font-medium transition-colors">
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </div>
  );
}
