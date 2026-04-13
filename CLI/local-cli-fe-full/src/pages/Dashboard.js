import React, {
  useState,
  useEffect,
  useCallback,
  Suspense,
  useRef,
} from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import Client from "./Client";
import Monitor from "./Monitor";
import Policies from "./Policies";
import AddData from "./AddData";
import UserProfile from "./UserProfile";
import ViewFiles from "./ViewFiles";
import Presets from "./Presets";
import Bookmarks from "./Bookmarks";
import SqlQueryGenerator from "./SqlQueryGenerator";
import BlockchainManager from "./BlockchainManager";
import PolicyGeneratorPage from "./Security";

// Unified plugin loader (dev = require.context, prod = Module Federation)
import {
  getPluginPages,
  refreshPluginPages,
  initializePluginOrder,
  discoverFederatedPlugins,
  fullEvictPlugin,
} from "../plugins/loader";

import {
  initializeFeatureConfig,
  isFeatureEnabled,
  isPluginEnabled,
} from "../services/featureConfig";

import { getBookmarks } from "../services/file_auth";
import "../styles/Dashboard.css";
import PluginErrorBoundary from "../plugins/marketplace/PluginErrorBoundary";

// ─── Detect federation (prod) mode ───────────────────────────────────────────

const IS_FEDERATION_MODE =
  window.__PLUGIN_MODE__ === "federation" ||
  window.location.port === "8000" ||
  window.location.port === "";

const PluginMountGate = ({ children }) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;
  return children;
};

const PluginRouteWithReload = ({ plugin, selectedNode }) => {
  const [fading, setFading] = React.useState(false);

  React.useEffect(() => {
    const visitedKey = `plugin-visited-${plugin.path}`;
    const reloadedKey = `plugin-just-reloaded-${plugin.path}`;

    const justReloaded = sessionStorage.getItem(reloadedKey);
    const hasVisited = sessionStorage.getItem(visitedKey);

    if (justReloaded) {
      sessionStorage.removeItem(reloadedKey);
      return;
    }

    if (hasVisited) {
      setFading(true);
      sessionStorage.setItem(reloadedKey, "true");
      sessionStorage.removeItem(visitedKey);
      // setTimeout(() => window.location.reload(), 300);
      return;
    }

    sessionStorage.setItem(visitedKey, "true");
  }, [plugin.path]);

  if (fading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "white",
          zIndex: 9999,
          transition: "opacity 0.3s",
        }}
      />
    );
  }

  return (
    <PluginErrorBoundary>
      <Suspense fallback={<PluginLoadingFallback name={plugin.name} />}>
        <plugin.component node={selectedNode} />
      </Suspense>
    </PluginErrorBoundary>
  );
};

// ─── Feature route config ─────────────────────────────────────────────────────

const FEATURE_ROUTES = [
  { path: "client", component: Client, featureKey: "client" },
  { path: "monitor", component: Monitor, featureKey: "monitor" },
  { path: "policies", component: Policies, featureKey: "policies" },
  { path: "adddata", component: AddData, featureKey: "adddata" },
  { path: "viewfiles", component: ViewFiles, featureKey: "viewfiles" },
  { path: "sqlquery", component: SqlQueryGenerator, featureKey: "sqlquery" },
  {
    path: "blockchain",
    component: BlockchainManager,
    featureKey: "blockchain",
  },
  { path: "presets", component: Presets, featureKey: "presets" },
  { path: "bookmarks", component: Bookmarks, featureKey: "bookmarks" },
  { path: "security", component: PolicyGeneratorPage, featureKey: "security" },
];

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const location = useLocation();

  const [pluginPages, setPluginPages] = useState(() => getPluginPages());

  // Feature config state
  const [enabledFeatures, setEnabledFeatures] = useState(new Set());
  const [enabledPlugins, setEnabledPlugins] = useState(new Set());
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load initial state from localStorage
  const [nodes, setNodes] = useState(() => {
    const saved = localStorage.getItem("dashboard-nodes");
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedNode, setSelectedNode] = useState(
    () => localStorage.getItem("dashboard-selected-node") || null,
  );
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);

  const isLoadingRef = useRef(false);

  const loadPluginsAndConfig = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
      const freshPages = await refreshPluginPages();
      setPluginPages((prev) => {
        const prevKeys = Object.keys(prev).sort().join(",");
        const nextKeys = Object.keys(freshPages).sort().join(",");
        return prevKeys === nextKeys ? prev : freshPages;
      });
      // setPluginPages(freshPages);

      await initializeFeatureConfig();
      const enabled = new Set();
      for (const route of FEATURE_ROUTES) {
        if (await isFeatureEnabled(route.featureKey))
          enabled.add(route.featureKey);
      }
      setEnabledFeatures(enabled);

      const enabledPluginSet = new Set();
      for (const pluginName of Object.keys(freshPages)) {
        if (await isPluginEnabled(pluginName)) enabledPluginSet.add(pluginName);
      }
      setEnabledPlugins(enabledPluginSet);
      setConfigLoaded(true);
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    initializePluginOrder();
    loadPluginsAndConfig();
  }, [loadPluginsAndConfig]);

  useEffect(() => {
    localStorage.setItem("dashboard-nodes", JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    if (selectedNode)
      localStorage.setItem("dashboard-selected-node", selectedNode);
    else localStorage.removeItem("dashboard-selected-node");
  }, [selectedNode]);

  useEffect(() => {
    if (selectedNode && !nodes.includes(selectedNode)) {
      setNodes((prev) => [...prev, selectedNode]);
    }
  }, [selectedNode, nodes]);

  useEffect(() => {
    const hasStored =
      localStorage.getItem("dashboard-nodes") ||
      localStorage.getItem("dashboard-selected-node");
    if (!hasStored) return;
    setRestoredFromStorage(true);
    const t = setTimeout(() => setRestoredFromStorage(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // Default bookmark on first load
  useEffect(() => {
    (async () => {
      try {
        if (!selectedNode) {
          const res = await getBookmarks();
          const list = Array.isArray(res.data) ? res.data : [];
          const def = list.find((b) => b.is_default);
          if (def?.node) {
            setSelectedNode(def.node);
            if (!nodes.includes(def.node))
              setNodes((prev) => [...prev, def.node]);
          }
        }
      } catch (e) {
        console.error("Dashboard error:", e);
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddNode = (newNode) => {
    if (newNode && !nodes.includes(newNode)) {
      setNodes((prev) => [...prev, newNode]);
    }
  };

  const clearStoredData = () => {
    localStorage.removeItem("dashboard-nodes");
    localStorage.removeItem("dashboard-selected-node");
    setNodes([]);
    setSelectedNode(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-container">
      <TopBar
        nodes={nodes}
        selectedNode={selectedNode}
        onAddNode={handleAddNode}
        onSelectNode={setSelectedNode}
        restoredFromStorage={restoredFromStorage}
        onClearStoredData={clearStoredData}
      />
      <div className="dashboard-content">
        <Sidebar />
        <div className="dashboard-main">
          <Routes>
            {/* ── Core feature routes ── */}
            {FEATURE_ROUTES.filter((r) =>
              enabledFeatures.has(r.featureKey),
            ).map((route) => {
              if (route.path === "bookmarks") {
                return (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={
                      <route.component
                        node={selectedNode}
                        onSelectNode={(node) => {
                          if (node && !nodes.includes(node)) {
                            setNodes((prev) => [...prev, node]);
                          }
                          setSelectedNode(node);
                        }}
                      />
                    }
                  />
                );
              }
              return (
                <Route
                  key={route.path}
                  path={route.path}
                  element={<route.component node={selectedNode} />}
                />
              );
            })}

            {/* ── Always-available routes ── */}
            <Route
              path="userprofile"
              element={<UserProfile node={selectedNode} />}
            />

            {/*             {configLoaded &&
              Object.entries(pluginPages)
                .filter(([name]) => enabledPlugins.has(name))
                .map(([key, plugin]) => (
                  <Route
                    key={key}
                    path={plugin.path}
                    element={
                      <React.Suspense
                        fallback={<PluginLoadingFallback name={plugin.name} />}
                      >
                        <plugin.component node={selectedNode} />
                      </React.Suspense>
                    }
                  />
                ))} */}

            {configLoaded &&
              Object.entries(pluginPages)
                .filter(([name]) => enabledPlugins.has(name))
                .map(([key, plugin]) => (
                  <Route
                    key={key}
                    path={plugin.path}
                    element={
                      <PluginMountGate key={location.pathname}>
                        <PluginErrorBoundary>
                          <Suspense
                            fallback={
                              <PluginLoadingFallback name={plugin.name} />
                            }
                          >
                            <plugin.component node={selectedNode} />
                          </Suspense>
                        </PluginErrorBoundary>
                      </PluginMountGate>
                    }
                  />
                ))}

            {/* ── Default / catch-all ── */}
            <Route
              path="*"
              element={(() => {
                if (enabledFeatures.has("client"))
                  return <Client node={selectedNode} />;
                const first = FEATURE_ROUTES.find((r) =>
                  enabledFeatures.has(r.featureKey),
                );
                if (first) {
                  const C = first.component;
                  return <C node={selectedNode} />;
                }
                return <div style={{ padding: 32 }}>No features enabled.</div>;
              })()}
            />
          </Routes>
        </div>
      </div>
    </div>
  );
};

const PluginLoadingFallback = ({ name }) => {
  return (
    <div style={{ padding: 32, color: "#64748b", fontSize: 14 }}>
      Loading {name}…
    </div>
  );
};

export default Dashboard;
