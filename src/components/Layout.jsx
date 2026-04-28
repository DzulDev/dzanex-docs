import { NavLink, useNavigate } from "react-router-dom";
import {
  FileText, Receipt, ShoppingCart, Truck,
  LayoutDashboard, Settings, LogOut, Menu
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { signOut } from "../utils/google";
import { version } from "../../package.json";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/quotation", icon: FileText, label: "Quotation" },
  { to: "/invoice", icon: Receipt, label: "Invoice" },
  { to: "/po", icon: ShoppingCart, label: "Purchase Order" },
  { to: "/do", icon: Truck, label: "Delivery Order" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

const UPDATE_CHECK_INTERVAL = 60_000; // check every 60s
const AUTO_REFRESH_DELAY    = 20_000; // auto-refresh after 20s if not dismissed

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const autoRefreshTimer = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let lastEtag = null;

    async function checkForUpdate() {
      try {
        const res = await fetch("/", { method: "HEAD", cache: "no-store" });
        const etag = res.headers.get("etag") || res.headers.get("last-modified");
        if (lastEtag === null) { lastEtag = etag; return; }
        if (etag && etag !== lastEtag) setUpdateReady(true);
      } catch { /* offline — skip */ }
    }

    const interval = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!updateReady) return;
    autoRefreshTimer.current = setTimeout(() => window.location.reload(), AUTO_REFRESH_DELAY);
    return () => clearTimeout(autoRefreshTimer.current);
  }, [updateReady]);

  function handleSignOut() {
    signOut();
    navigate("/login");
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-60 bg-[#1B3A5C] text-white flex flex-col
        transform transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full"}
        lg:relative lg:translate-x-0
      `}>
        <div className="px-5 py-5 border-b border-[#57A9A9]/30 flex items-center gap-3">
          <img src="/logo.png" alt="Dzanex" className="w-10 h-10 object-contain" />
          <div>
            <p className="text-xs text-[#57A9A9] font-medium">DZANEX TECHNOLOGY</p>
            <p className="text-xs text-[#57A9A9]/70 mt-0.5">TR0320764-P</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? "bg-[#57A9A9] text-white"
                  : "text-white/70 hover:bg-[#57A9A9]/20 hover:text-white"
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-[#57A9A9]/30">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="text-gray-600">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-gray-800">Dzanex Docs</span>
        </header>
        {/* Update banner */}
        {updateReady && (
          <div className="shrink-0 bg-[#57A9A9] text-white text-xs px-4 py-2 flex items-center justify-between gap-3">
            <span>🔄 New update available!</span>
            <div className="flex items-center gap-2">
              <span className="opacity-75">Auto-refresh in 20s…</span>
              <button
                onClick={() => { clearTimeout(autoRefreshTimer.current); window.location.reload(); }}
                className="bg-white text-[#1B3A5C] font-semibold px-3 py-0.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                Refresh now
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {children}
        </main>
        <footer className="shrink-0 border-t border-gray-100 bg-white px-4 py-2 flex items-center justify-between text-xs text-gray-400">
          <span>© {new Date().getFullYear()} Dzanex Technology</span>
          <span>v{version}</span>
        </footer>
      </div>
    </div>
  );
}
