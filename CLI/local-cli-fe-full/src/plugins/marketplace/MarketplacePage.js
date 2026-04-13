import { discoverFederatedPlugins } from "../loader";

import React, { useState, useEffect, useCallback } from "react";
import "./styles/MarketplacePage.css";
import { Box, Modal } from "@mui/material";
import PluginCard from "./PluginCard";
import PluginDetailsView from "./PluginDetails";
import PluginStats from "./PluginStats";
import PluginErrorBoundary from "./PluginErrorBoundary";
import DynamicPlugins from "./DynamicPlugins";
import { getInstalledPlugins } from "./marketplace_api";
import ZipInstall from "./ZipInstall";

const INITIAL_PLUGINS = [
  {
    id: "remote-console",
    name: "SSH - Remote Console",
    slug: "anylog/ssh",
    description:
      "Launch multiple SSH connections to your nodes seamlessly from inside the GUI",
    version: "1.0.0",
    thumbnail: "https://www.undrground.org/wp-content/uploads/2019/06/ssh.png",
    authorThumbnail:
      "https://miro.medium.com/v2/resize:fit:800/1%2AzC_0Pkr4iFEbwbHhcG-dHw.png",
    readmeLink: "http://localhost:8081/weather-plugin.md",
  },
  {
    id: "grafana-dash",
    name: "Grafana",
    slug: "anylog/grafana",
    description:
      "Visualize real-time system metrics across your infrastructure with integrated Prometheus metrics and Grafana dashboards.",
    version: "1.0.0",
    thumbnail:
      "https://www.soeldner-consult.de/wp-content/uploads/2024/03/PrometheusGranfa.png",
    authorThumbnail:
      "https://miro.medium.com/v2/resize:fit:800/1%2AzC_0Pkr4iFEbwbHhcG-dHw.png",
    readmeLink: "http://localhost:8081/weather-plugin.md",
  },
  {
    id: "chat",
    name: "Chat",
    slug: "anylog/chat",
    description:
      "Receive AI insights, visual reports, and automated workflow completion all directly from inside the chatbox.",
    version: "1.0.0",
    thumbnail:
      "https://cdn.sanity.io/images/3jwyzebk/production/e3f8d6ac0106744a859c305e903837fa0c68108c-877x621.png?auto=format&fit=max&w=1920&q=75",
    authorThumbnail:
      "https://miro.medium.com/v2/resize:fit:800/1%2AzC_0Pkr4iFEbwbHhcG-dHw.png",
    readmeLink: "http://localhost:8081/weather-plugin.md",
  },
  {
    id: "file-manager",
    name: "File Manager",
    slug: "anylog/fsmanager",
    description:
      "Manage your remote file systems and handle data uploads directly within the GUI.",
    version: "1.0.0",
    thumbnail:
      "https://static.vecteezy.com/system/resources/thumbnails/050/550/628/small/icon-of-file-application-in-blue-color-with-gradient-for-mobile-phone-vector.jpg",
    authorThumbnail:
      "https://miro.medium.com/v2/resize:fit:800/1%2AzC_0Pkr4iFEbwbHhcG-dHw.png",
    readmeLink: "http://localhost:8081/weather-plugin.md",
  },
];

const MarketplacePage = () => {
  const [plugins] = useState(INITIAL_PLUGINS);
  const [installedPlugins, setInstalledPlugins] = useState([]);
  const [installedIds, setInstalledIds] = useState(new Set());
  const [enabledIds, setEnabledIds] = useState(new Set());
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [search, setSearch] = useState("");
  const [modalType, setModalType] = useState(null);

  const isInstalled = (id) => installedIds.has(id);
  const isEnabled = (id) => enabledIds.has(id);

  const fetchInstalled = useCallback(async () => {
    try {
      const installed = await getInstalledPlugins();
      console.log(`Installed: ${JSON.stringify(installed)}`);
      setInstalledPlugins(installed);
    } catch (e) {
      console.error(`Failed getting installed plugins: ${e}`);
    }
  }, []);

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

  const filtered = installedPlugins.filter(
    (p) =>
      p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
      p.slug.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

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
          flexDirection: "column",
          justifyContent: "start",
          width: "100%",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
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
            width: "100%",
            outline: "none",
            fontSize: "14px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        />
      </header>

      <ZipInstall onInstallComplete={fetchInstalled} />

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
            installed={installedPlugins.find((i) => i.slug === p.slug)}
            enabled={isEnabled(p.id)}
            onInstall={() => handleInstall(p.id)}
            onEnable={() => handleEnable(p.id)}
            onExpand={() => {
              setModalType("details");
              setSelectedPlugin(p);
            }}
            onTriggerMetrics={() => {
              setModalType("stats");
              setSelectedPlugin(p);
            }}
          />
        ))}
      </div>

      {selectedPlugin && (
        <Modal
          open={!!selectedPlugin}
          onClose={() => setSelectedPlugin(null)}
          slotProps={{
            backdrop: {
              style: {
                backdropFilter: "blur(4px)",
                backgroundColor: "rgba(0,0,0,0.4)",
              },
            },
          }}
        >
          <Box sx={modalStyle}>
            {modalType === "stats" ? (
              <PluginStats
                sseUrl={`http://localhost:8000/plugins/logs?slug=${encodeURIComponent(selectedPlugin.slug)}`}
              />
            ) : (
              <PluginDetailsView
                selectedPlugin={selectedPlugin}
                closeModalCallback={() => setSelectedPlugin(null)}
              />
            )}
          </Box>
        </Modal>
      )}
    </div>
  );
};

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "95vw",
  height: "95vh",
  maxWidth: "95vw",
  bgcolor: "background.paper",
  boxShadow: 24,
  borderRadius: "20px",
  outline: "none",
  overflow: "auto",
};

export default MarketplacePage;
