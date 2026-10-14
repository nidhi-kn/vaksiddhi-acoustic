import { useEffect, useState, lazy, Suspense } from "react";
import {
  BrowserRouter,
  NavLink,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { motion, MotionConfig } from "framer-motion";
import {
  LayoutDashboard,
  AudioLines,
  Mic,
  History,
  SlidersHorizontal,
  Info,
  ShieldCheck,
  Menu,
  ChevronRight,
  CircleHelp,
  Check,
} from "lucide-react";
import { api, loadHistory, date } from "./lib";
import { Empty, Modal, Result } from "./components";
import Analyze from "./Analyze";
import HistoryPage from "./HistoryPage";
import { ModelPage, About } from "./Information";
const Dashboard = lazy(() => import("./Dashboard"));
const navigation = [
  ["/", "Dashboard", LayoutDashboard],
  ["/analyze", "Analyze audio", AudioLines],
  ["/record", "Record audio", Mic],
  ["/history", "Analysis history", History],
  ["/model", "Model information", SlidersHorizontal],
  ["/about", "About the project", Info],
];
function Shell() {
  const [items, setItems] = useState(loadHistory),
    [selected, setSelected] = useState(null),
    [storageError, setStorageError] = useState(""),
    [health, setHealth] = useState("checking"),
    [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => {
    let active = true;
    const check = () =>
      api
        .get("/api/health", { timeout: 5000 })
        .then(({ data }) => {
          if (active) setHealth(data.model_loaded ? "ready" : "unavailable");
        })
        .catch(() => {
          if (active) setHealth("offline");
        });
    check();
    const timer = setInterval(check, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  function persist(next) {
    setItems(next);
    try {
      localStorage.setItem("vak-history-v1", JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable. Results remain available for this session only.",
      );
    }
  }
  const current =
    navigation.find((x) => x[0] === location.pathname)?.[1] || "Workspace";
  return (
    <div className="app">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link className="brand" to="/" onClick={() => setMenu(false)}>
          <span className="brand-icon">
            <AudioLines size={24} />
          </span>
          <span>
            Vak-Siddhi<small>ACOUSTIC INTELLIGENCE</small>
          </span>
        </Link>
        <span className="nav-caption">WORKSPACE</span>
        <nav>
          {navigation.map(([path, label, Icon], index) => (
            <NavLink
              key={path}
              to={path}
              end
              onClick={() => setMenu(false)}
              className={index === 4 ? "nav-divider" : ""}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="model-status">
            <span
              className={`status-dot ${health !== "ready" ? "offline" : ""}`}
            />
            <div>
              <strong>
                {health === "ready"
                  ? "Model connected"
                  : health === "checking"
                    ? "Connecting..."
                    : "Backend unavailable"}
              </strong>
              <span>MobileNetV2 Student</span>
            </div>
          </div>
          <div className="research-label">
            <ShieldCheck size={17} /> Research workspace <span>v1.0</span>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="nav-overlay"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header>
          <button
            className="icon-button mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>{current}</strong>
          </div>
          <div className="header-right">
            <span className="local-pill">
              <span className="status-dot" /> Local workspace
            </span>
            <Link
              to="/about"
              className="icon-button"
              aria-label="About this project"
            >
              <CircleHelp size={19} />
            </Link>
            <div className="avatar">VS</div>
          </div>
        </header>
        <main>
          {storageError && (
            <div className="error" role="alert">
              {storageError}
            </div>
          )}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Suspense
              fallback={
                <div className="skeleton" role="status">
                  Loading workspace...
                </div>
              }
            >
              <Routes>
                <Route
                  path="/"
                  element={<Dashboard items={items} onSelect={setSelected} />}
                />
                <Route
                  path="/analyze"
                  element={
                    <Analyze
                      onSave={(item) => persist([item, ...items].slice(0, 200))}
                    />
                  }
                />
                <Route
                  path="/record"
                  element={
                    <Analyze
                      record
                      onSave={(item) => persist([item, ...items].slice(0, 200))}
                    />
                  }
                />
                <Route
                  path="/history"
                  element={
                    <HistoryPage
                      items={items}
                      onSelect={setSelected}
                      onDelete={() => persist([])}
                    />
                  }
                />
                <Route path="/model" element={<ModelPage />} />
                <Route path="/about" element={<About />} />
                <Route
                  path="*"
                  element={
                    <Empty
                      title="Page not found"
                      text="Return to your acoustic workspace to continue."
                    />
                  }
                />
              </Routes>
            </Suspense>
          </motion.div>
          <footer>
            <span>Vak-Siddhi · Acoustic screening prototype</span>
            <span>
              <Check size={13} /> Prerecorded audio only
            </span>
          </footer>
        </main>
      </div>
      {selected && (
        <Modal title={selected.audio_file} onClose={() => setSelected(null)}>
          <p className="muted">{date(selected.created_at)}</p>
          <Result result={selected} />
        </Modal>
      )}
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <Shell />
      </MotionConfig>
    </BrowserRouter>
  );
}
