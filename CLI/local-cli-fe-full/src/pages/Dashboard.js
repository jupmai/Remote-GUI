import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import Client from './Client';
import Monitor from './Monitor';
import Policies from './Policies';
import AddData from './AddData';
import UserProfile from './UserProfile';
import ViewFiles from './ViewFiles';
import Presets from './Presets';
import Bookmarks from './Bookmarks';
import SqlQueryGenerator from './SqlQueryGenerator';
import BlockchainManager from './BlockchainManager';
import PolicyGeneratorPage from './Security';

// Unified plugin loader (dev = require.context, prod = Module Federation)
import { getPluginPages, refreshPluginPages, initializePluginOrder } from '../plugins/loader';

import {
  initializeFeatureConfig,
  isFeatureEnabled,
  isPluginEnabled,
} from '../services/featureConfig';

import { getBookmarks } from '../services/file_auth';
import '../styles/Dashboard.css';

// ─── Detect federation (prod) mode ───────────────────────────────────────────

const IS_FEDERATION_MODE =
  window.__PLUGIN_MODE__ === 'federation' ||
  window.location.port === '8000' ||
  window.location.port === '';

// ─── Feature route config ─────────────────────────────────────────────────────

const FEATURE_ROUTES = [
  { path: 'client',     component: Client,              featureKey: 'client' },
  { path: 'monitor',    component: Monitor,             featureKey: 'monitor' },
  { path: 'policies',   component: Policies,            featureKey: 'policies' },
  { path: 'adddata',    component: AddData,             featureKey: 'adddata' },
  { path: 'viewfiles',  component: ViewFiles,           featureKey: 'viewfiles' },
  { path: 'sqlquery',   component: SqlQueryGenerator,   featureKey: 'sqlquery' },
  { path: 'blockchain', component: BlockchainManager,   featureKey: 'blockchain' },
  { path: 'presets',    component: Presets,             featureKey: 'presets' },
  { path: 'bookmarks',  component: Bookmarks,           featureKey: 'bookmarks' },
  { path: 'security',   component: PolicyGeneratorPage, featureKey: 'security' },
];

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = () => {
  // ── Plugin pages state ──────────────────────────────────────────────────────
  // Start with the synchronous snapshot (populated in dev, empty in prod until
  // refreshPluginPages() resolves).
  const [pluginPages, setPluginPages] = useState(() => getPluginPages());

  // ── Feature config state ────────────────────────────────────────────────────
  const [enabledFeatures, setEnabledFeatures] = useState(new Set());
  const [enabledPlugins,  setEnabledPlugins]  = useState(new Set());
  const [configLoaded,    setConfigLoaded]    = useState(false);

  // ── Node / persistence state ────────────────────────────────────────────────
  const [nodes, setNodes] = useState(() => {
    const saved = localStorage.getItem('dashboard-nodes');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedNode, setSelectedNode] = useState(
    () => localStorage.getItem('dashboard-selected-node') || null
  );
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);

  // ── Load plugins + feature config ──────────────────────────────────────────

  const loadPluginsAndConfig = useCallback(async () => {
    // 1. Pull fresh plugin pages (works in both modes)
    const freshPages = await refreshPluginPages();
    setPluginPages(freshPages);

    // 2. Feature config
    await initializeFeatureConfig();

    const enabled = new Set();
    for (const route of FEATURE_ROUTES) {
      if (await isFeatureEnabled(route.featureKey)) enabled.add(route.featureKey);
    }
    setEnabledFeatures(enabled);

    // 3. Plugin enable/disable flags
    const enabledPluginSet = new Set();
    for (const pluginName of Object.keys(freshPages)) {
      if (await isPluginEnabled(pluginName)) enabledPluginSet.add(pluginName);
    }
    setEnabledPlugins(enabledPluginSet);
    setConfigLoaded(true);
  }, []);

  useEffect(() => {
    initializePluginOrder();
    loadPluginsAndConfig();
  }, [loadPluginsAndConfig]);

  // In federation mode, poll every 5 s so the UI reflects start/stop actions
  // triggered from the PluginDevPanel (or the backend) without a full reload.
  useEffect(() => {
    if (!IS_FEDERATION_MODE) return;
    const id = setInterval(loadPluginsAndConfig, 5000);
    return () => clearInterval(id);
  }, [loadPluginsAndConfig]);

  // ── Persistence side-effects ────────────────────────────────────────────────

  useEffect(() => {
    localStorage.setItem('dashboard-nodes', JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    if (selectedNode) localStorage.setItem('dashboard-selected-node', selectedNode);
    else              localStorage.removeItem('dashboard-selected-node');
  }, [selectedNode]);

  useEffect(() => {
    if (selectedNode && !nodes.includes(selectedNode)) {
      setNodes((prev) => [...prev, selectedNode]);
    }
  }, [selectedNode, nodes]);

  useEffect(() => {
    const hasStored =
      localStorage.getItem('dashboard-nodes') ||
      localStorage.getItem('dashboard-selected-node');
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
          const res  = await getBookmarks();
          const list = Array.isArray(res.data) ? res.data : [];
          const def  = list.find((b) => b.is_default);
          if (def?.node) {
            setSelectedNode(def.node);
            if (!nodes.includes(def.node)) setNodes((prev) => [...prev, def.node]);
          }
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const handleAddNode = (newNode) => {
    if (newNode && !nodes.includes(newNode)) {
      setNodes((prev) => [...prev, newNode]);
    }
  };

  const clearStoredData = () => {
    localStorage.removeItem('dashboard-nodes');
    localStorage.removeItem('dashboard-selected-node');
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
            {FEATURE_ROUTES.filter((r) => enabledFeatures.has(r.featureKey)).map((route) => {
              if (route.path === 'bookmarks') {
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
            <Route path="userprofile" element={<UserProfile node={selectedNode} />} />

            {/* ── Plugin routes (dev = local lazy, prod = MF lazy) ── */}
            {configLoaded &&
              Object.entries(pluginPages)
                .filter(([name]) => enabledPlugins.has(name))
                .map(([key, plugin]) => (
                  <Route
                    key={key}
                    path={plugin.path}
                    element={
                      <React.Suspense fallback={<PluginLoadingFallback name={plugin.name} />}>
                        <plugin.component node={selectedNode} />
                      </React.Suspense>
                    }
                  />
                ))}

            {/* ── Default / catch-all ── */}
            <Route
              path="*"
              element={(() => {
                if (enabledFeatures.has('client')) return <Client node={selectedNode} />;
                const first = FEATURE_ROUTES.find((r) => enabledFeatures.has(r.featureKey));
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

// ─── Small helpers ────────────────────────────────────────────────────────────

function PluginLoadingFallback({ name }) {
  return (
    <div style={{ padding: 32, color: '#64748b', fontSize: 14 }}>
      Loading {name}…
    </div>
  );
}

export default Dashboard;
