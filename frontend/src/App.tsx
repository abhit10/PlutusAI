import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import LandingPage from "./pages/LandingPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import PortfolioPage from "./pages/PortfolioPage.tsx";
import { marketPath, savedMarket } from "./lib/market";
import { Skeleton } from "./components/ui";
import AppLayout from "./components/AppLayout.tsx";

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {children}
    </div>
  );
}

export default function App() {
  const { user, loading, error } = useAuth();

  if (error)
    return (
      <FullScreen>
        <div role="alert" className="flex flex-col gap-4">
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-[var(--color-accent)]"
          >
            Retry session
          </button>
        </div>
      </FullScreen>
    );

  if (loading) return <Skeleton shell />;

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/stocks/*" element={<Navigate to="/auth?market=stock" replace />} />
        <Route path="/crypto/*" element={<Navigate to="/auth?market=crypto" replace />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to={marketPath(savedMarket())} replace />} />
        <Route path="/stocks" element={<DashboardPage key="stock" market="stock" />} />
        <Route path="/crypto" element={<DashboardPage key="crypto" market="crypto" />} />
        <Route path="/stocks/:id" element={<PortfolioPage key="stock" market="stock" />} />
        <Route path="/crypto/:id" element={<PortfolioPage key="crypto" market="crypto" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
