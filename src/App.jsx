import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider, RequireAuth, RequireGuest } from "./context/AuthContext";
import Home from "./pages/Home";
// import UserInfo from "./pages/userInfo";
import SalersReport from "./pages/SalersReport";
import LoginPage from "./pages/LoginPage";

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
      <AuthProvider>
        <Routes>
          {/* already logged in? skip straight past the login form */}
          <Route
            path="/login"
            element={
              <RequireGuest>
                <LoginPage />
              </RequireGuest>
            }
          />

          {/* everything else requires a logged-in user in localStorage */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
          <Route
            path="/sales-report"
            element={
              <RequireAuth>
                <SalersReport />
              </RequireAuth>
            }
          />
          {/* <Route
            path="/users"
            element={
              <RequireAuth>
                <UserInfo />
              </RequireAuth>
            }
          /> */}

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}