import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import UserInfo from "./pages/UserInfo";
import SalersReport from "./pages/SalersReport";

/* ---------------- 404 ---------------- */

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4">
      <p className="text-6xl font-bold text-slate-300">404</p>
      <p className="mt-2 text-slate-500">This page doesn't exist.</p>
      <Link
        to="/"
        className="mt-6 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-orange-500/30 transition-colors hover:bg-orange-600"
      >
        Back to Home
      </Link>
    </div>
  );
}

/* ---------------- app ---------------- */

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sales-report" element={<SalersReport />} />
        <Route path="/users" element={<UserInfo />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}