import { discoverFederatedPlugins } from "../loader";

import React, { useState, useEffect, useCallback } from "react";
import "./styles/MarketplacePage.css";

const INITIAL_PLUGINS = [
  {
    id: "calc-plugin",
    name: "Calculator",
    slug: "anylog/calculator",
    description:
      "Perform complex arithmetic and scientific calculations directly in your dashboard.",
    version: "1.0.2",
    thumbnail:
      "https://miro.medium.com/v2/resize:fit:800/1%2AzC_0Pkr4iFEbwbHhcG-dHw.png",
  },
  {
    id: "weather-plugin",
    name: "Weather",
    slug: "anylog/calculator",
    description:
      "Get real-time weather updates and 7-day forecasts based on your current location.",
    version: "2.1.0",
    thumbnail:
      "https://miro.medium.com/v2/resize:fit:800/1%2AzC_0Pkr4iFEbwbHhcG-dHw.png",
  },
];

const MarketplacePage = () => {
  const [plugins] = useState(INITIAL_PLUGINS);
  const [installedIds, setInstalledIds] = useState(new Set());
  const [enabledIds, setEnabledIds] = useState(new Set());
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [search, setSearch] = useState("");

  // Helpers
  const isInstalled = (id) => installedIds.has(id);
  const isEnabled = (id) => enabledIds.has(id);

  const handleInstall = (id) => {
    const next = new Set(installedIds);
    if (next.has(id)) {
      next.delete(id);
      const nextEnabled = new Set(enabledIds);
      nextEnabled.delete(id);
      setEnabledIds(nextEnabled);
    } else {
      next.add(id);
    }
    setInstalledIds(next);
  };

  const handleEnable = (id) => {
    const next = new Set(enabledIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEnabledIds(next);
  };

  const filtered = plugins.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div
      style={{
        padding: "40px",
        fontFamily: "Inter, sans-serif",
        backgroundColor: "#f9fafb",
        minHeight: "100vh",
      }}
    >
      <header
        style={{
          marginBottom: "32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: "800",
              color: "#111827",
              letterSpacing: "-0.5px",
            }}
          >
            Plugin Marketplace
          </h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "15px" }}>
            Extend your workspace with official modules.
          </p>
        </div>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "12px 18px",
            borderRadius: "14px",
            border: "1px solid #e5e7eb",
            width: "280px",
            outline: "none",
            fontSize: "14px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        />
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "24px",
        }}
      >
        {filtered.map((p) => (
          <PluginCard
            key={p.id}
            plugin={p}
            installed={isInstalled(p.id)}
            enabled={isEnabled(p.id)}
            onInstall={() => handleInstall(p.id)}
            onEnable={() => handleEnable(p.id)}
            onExpand={() => setSelectedPlugin(p)}
          />
        ))}
      </div>

      {/* Detail Modal */}
      {selectedPlugin && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setSelectedPlugin(null)}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "32px",
              borderRadius: "24px",
              maxWidth: "500px",
              width: "90%",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPlugin.thumbnail}
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "16px",
                marginBottom: "20px",
              }}
              alt=""
            />
            <h2 style={{ margin: "0 0 8px" }}>{selectedPlugin.name}</h2>
            <p style={{ color: "#6b7280", lineHeight: 1.6 }}>
              {selectedPlugin.description}
            </p>
            <p style={{ fontSize: "13px", color: "#9ca3af" }}>
              Version {selectedPlugin.version}
            </p>
            <button
              onClick={() => setSelectedPlugin(null)}
              style={{
                marginTop: "24px",
                width: "100%",
                padding: "12px",
                border: "none",
                backgroundColor: "#f3f4f6",
                borderRadius: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function PluginCard({
  plugin,
  installed,
  enabled,
  onInstall,
  onEnable,
  onExpand,
}) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: "24px",
        padding: "20px",
        border: "1px solid #f3f4f6",
        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <img
          src={plugin.thumbnail}
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            objectFit: "cover",
          }}
          alt=""
        />
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700" }}>
            {plugin.name}
          </h3>
          <div style={{ display: 'flex', gap: 4 }}>
            <span style={{ margin: 0, fontSize: "13px", fontWeight: "400" }}>
              {plugin.slug}
            </span>
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>
              v{plugin.version}
            </span>
          </div>
        </div>
        <button
          onClick={onExpand}
          style={{
            background: "none",
            border: "none",
            color: "#3b82f6",
            fontWeight: "600",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Details
        </button>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: "14px",
          color: "#6b7280",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          minHeight: "40px",
        }}
      >
        {plugin.description}
      </p>

      <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
        {!installed ? (
          <button
            onClick={onInstall}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "12px",
              border: "none",
              backgroundColor: "#3b82f6",
              color: "white",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Install
          </button>
        ) : (
          <>
            <button
              onClick={onEnable}
              style={{
                flex: 2,
                padding: "10px",
                borderRadius: "12px",
                border: "none",
                backgroundColor: enabled ? "#fee2e2" : "#dcfce7",
                color: enabled ? "#dc2626" : "#15803d",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {enabled ? "Disable" : "Enable"}
            </button>
            <button
              onClick={onInstall}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "12px",
                border: "1px solid #f3f4f6",
                backgroundColor: "white",
                color: "#9ca3af",
                fontWeight: "600",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Uninstall
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// const MarketplacePage = () => {
//   const [pages, setPages] = useState(null);
//   const [activeId, setActiveId] = useState(null);

//   const ActivePlugin = activeId && pages?.[activeId]?.component;

//   const discover = async () => {
//     setPages(null);
//     setActiveId(null);
//     const discovered = await discoverFederatedPlugins();
//     console.log(`Discovery complete:`);
//     console.log(discovered);
//     setPages(discovered);
//   };
//   return (
//     <div>
//       <h1>Marketplace</h1>

//       <button onClick={discover}>
//         Discover
//       </button>

//       {pages && (
//         <div style={{ marginBottom: 24 }}>
//           <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
//             {Object.entries(pages).map(([id, p]) => (
//               <button key={id} onClick={() => setActiveId(id)}>
//                 Navigate to /{id}
//               </button>
//             ))}
//           </div>
//         </div>
//       )}

//       {ActivePlugin && (
//         <div style={{ marginBottom: 24 }}>
//           <Suspense fallback={
//             <div style={{ padding: "16px 0", color: "#6366f1", fontSize: 13 }}>
//               Injecting remoteEntry.js, waiting for MF
//             </div>
//           }>
//             <ActivePlugin />
//           </Suspense>
//         </div>
//       )}
//     </div>
//   )
// };

export default MarketplacePage;
