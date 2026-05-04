import React, { useState, useEffect, useCallback } from "react";
import "./styles/MarketplacePage.css";
import { Box, Modal } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import PluginDetailsView from "./PluginDetails";
import {
  getInstalledPlugins,
  enablePlugin,
  disablePlugin,
  uninstallPlugin,
} from "./marketplace_api";
import useRegistry from "./hooks/useRegistry";
import useDownloadManager from "./hooks/useDownloadManager";
import usePluginInstall from "./hooks/usePluginInstall";
import PluginCard from "./components/PluginCard";
import ZipInstall from "./components/ZipInstall";
import PluginStats from "./components/PluginStats";
import RegistryEditor from "./components/RegistryEditor";
import DownloadManager from "./components/DownloadManager";

const TABS = ["ALL", "INSTALLED"];

const MODAL_STYLE = {
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

const BACKDROP_PROPS = {
  backdrop: {
    style: {
      backdropFilter: "blur(4px)",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
  },
};

const MarketplacePage = () => {
  const [installedPlugins, setInstalledPlugins] = useState([]);
  const [enabledSlugs, setEnabledSlugs] = useState(new Set());
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [anchorEl, setAnchorEl] = useState(null);
  const [installMethod, setInstallMethod] = useState(null);
  const [registries, setRegistries] = useState([]);

  const { fetchPlugins, allPlugins, resetSources } = useRegistry();
  const { installs, addInstall, updateInstall, removeInstall } = useDownloadManager();
  const { install } = usePluginInstall();

  const fetchInstalled = useCallback(async () => {
    try {
      const installed = await getInstalledPlugins();
      setInstalledPlugins(installed);
      setEnabledSlugs(new Set(installed.filter((p) => p.enabled).map((p) => p.slug)));
    } catch (e) {
      console.error("Failed getting installed plugins:", e);
    }
  }, []);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("plugin-marketplace/registries/sources");
      if (stored) {
        setRegistries(JSON.parse(stored));
      } else {
        const defaults = [{ url: "http://localhost:8081/registry-manifest.json", enabled: true }];
        localStorage.setItem("plugin-marketplace/registries/sources", JSON.stringify(defaults));
        setRegistries(defaults);
      }
    } catch (e) {
      console.error("[plugin-marketplace] failed retrieving registry sources:", e);
    }
  }, []);

  useEffect(() => {
    const enabled = registries.filter((r) => r.enabled);
    if (!enabled.length) return;

    resetSources(enabled.map((r) => r.url));
    enabled.forEach((r) =>
      fetchPlugins(r.url).catch(() => console.error("Failed loading registry:", r))
    );
  }, [registries]);

  const handleInstall = (plugin) => {
    addInstall(plugin.core.slug, plugin.core.name);
    install(plugin, { onStatusChange: updateInstall, onInstallComplete: fetchInstalled });
  };

  const handleEnabledStateChange = async (slug, currentlyEnabled) => {
    try {
      if (currentlyEnabled) {
        await disablePlugin(slug);
        setEnabledSlugs((prev) => { const n = new Set(prev); n.delete(slug); return n; });
      } else {
        await enablePlugin(slug);
        setEnabledSlugs((prev) => new Set(prev).add(slug));
      }
    } catch (e) {
      console.error("Failed toggling plugin state:", e);
    }
  };

  const handleUninstall = async (slug) => {
    try {
      await uninstallPlugin(slug);
      await fetchInstalled();
    } catch (e) {
      console.error("Failed uninstalling plugin:", e);
    }
  };

  const handleRegistrySave = () => {
    try {
      const stored = localStorage.getItem("plugin-marketplace/registries/sources");
      if (stored) setRegistries(JSON.parse(stored));
    } catch (e) {
      console.error("Failed reloading registries:", e);
    }
    fetchInstalled();
  };

  const installedSlugs = new Set(installedPlugins.map((p) => p.slug));

  const filteredPlugins = allPlugins().filter((p) => {
    const matchesSearch =
      p.core.name.toLowerCase().includes(search.toLowerCase()) ||
      p.core.slug.toLowerCase().includes(search.toLowerCase());

    const matchesTab =
      activeTab === "ALL" || (activeTab === "INSTALLED" && installedSlugs.has(p.core.slug));

    return matchesSearch && matchesTab;
  });

  return (
    <div className="mp-page">
      <header className="mp-header">
        <div className="mp-header-text">
          <h1>Plugin Marketplace</h1>
          <p>Extend your workspace with official modules.</p>
        </div>

        <div className="mp-controls">
          <div className="mp-tab-group">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`mp-tab ${activeTab === tab ? "mp-tab--active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                {tab === "INSTALLED" && installedPlugins.length > 0 && (
                  <span className="mp-tab-count">{installedPlugins.length}</span>
                )}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="mp-search"
            placeholder="Search plugins…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Button
            variant="outlined"
            endIcon={<KeyboardArrowDownIcon />}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            className="mp-install-btn"
          >
            Install
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{ style: { borderRadius: "12px", marginTop: "6px" } }}
          >
            <MenuItem onClick={() => { setInstallMethod("MANIFEST"); setAnchorEl(null); }}>
              Direct Manifest
            </MenuItem>
            <MenuItem onClick={() => { setInstallMethod("REGISTRY"); setAnchorEl(null); }}>
              Add a registry source
            </MenuItem>
          </Menu>
        </div>
      </header>

      <DownloadManager installs={installs} onRemove={removeInstall} />

      {filteredPlugins.length === 0 ? (
        <p className="mp-empty">
          {activeTab === "INSTALLED" ? "No plugins installed yet." : "No plugins found."}
        </p>
      ) : (
        <div className="mp-grid">
          {filteredPlugins.map((p) => (
            <PluginCard
              key={p.core.id}
              plugin={p}
              installed={installedPlugins.find((i) => i.slug === p.core.slug)}
              enabled={enabledSlugs.has(p.core.slug)}
              onInstall={() => handleInstall(p)}
              onEnabledStateChange={(currentlyEnabled) =>
                handleEnabledStateChange(p.core.slug, currentlyEnabled)
              }
              onUninstall={() => handleUninstall(p.core.slug)}
              onExpand={() => { setModalType("details"); setSelectedPlugin(p); }}
              onTriggerMetrics={() => { setModalType("stats"); setSelectedPlugin(p); }}
            />
          ))}
        </div>
      )}

      {installMethod === "MANIFEST" && (
        <Modal open onClose={() => setInstallMethod(null)} slotProps={BACKDROP_PROPS}>
          <Box sx={MODAL_STYLE}>
            <ZipInstall onInstallComplete={fetchInstalled} />
          </Box>
        </Modal>
      )}

      {installMethod === "REGISTRY" && (
        <Modal open onClose={() => setInstallMethod(null)} slotProps={BACKDROP_PROPS}>
          <Box sx={MODAL_STYLE}>
            <RegistryEditor onSave={handleRegistrySave} />
          </Box>
        </Modal>
      )}

      {selectedPlugin && (
        <Modal open onClose={() => setSelectedPlugin(null)} slotProps={BACKDROP_PROPS}>
          <Box sx={MODAL_STYLE}>
            {modalType === "stats" ? (
              <PluginStats
                sseUrl={`http://localhost:8000/plugins/logs?slug=${encodeURIComponent(selectedPlugin.core.slug)}`}
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

export default MarketplacePage;