import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DocPage from "./pages/DocPage";
import Settings from "./pages/Settings";
import { generateQuotation, generateInvoice, generatePO, generateDO } from "./utils/pdf";
import { getToken } from "./utils/google";
import { getConfig, saveConfig } from "./utils/storage";

function RequireAuth({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

function preloadLogo() {
  const { logoDataUrl } = getConfig();
  if (logoDataUrl) return;
  fetch("/logo.png")
    .then((r) => r.blob())
    .then((blob) => {
      const reader = new FileReader();
      reader.onload = () => saveConfig({ logoDataUrl: reader.result });
      reader.readAsDataURL(blob);
    })
    .catch(() => {});
}

export default function App() {
  useEffect(() => { preloadLogo(); }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <RequireAuth>
            <Layout>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path="quotation" element={
                  <DocPage key="quotation" type="Quotation" title="Quotation" prefix="QT" sheetName="Quotation"
                    showPrice showTax showValidUntil partyLabel="Client"
                    generateFn={generateQuotation} />
                } />
                <Route path="invoice" element={
                  <DocPage key="invoice" type="Invoice" title="Invoice" prefix="INV" sheetName="Invoice"
                    showPrice showTax partyLabel="Client"
                    generateFn={generateInvoice} />
                } />
                <Route path="po" element={
                  <DocPage key="po" type="PO" title="Purchase Order" prefix="PO" sheetName="PO"
                    showPrice showTax partyLabel="Supplier"
                    generateFn={generatePO} />
                } />
                <Route path="do" element={
                  <DocPage key="do" type="DO" title="Delivery Order" prefix="DO" sheetName="DO"
                    showPrice={false} showTax={false} partyLabel="Client"
                    generateFn={generateDO} />
                } />
                <Route path="settings" element={<Settings />} />
              </Routes>
            </Layout>
          </RequireAuth>
        } />
      </Routes>
    </BrowserRouter>
  );
}
