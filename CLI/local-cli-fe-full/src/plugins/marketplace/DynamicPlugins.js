import {
  discoverFederatedPlugins,
  evictFederatedPlugin,
  federationCache,
} from "../loader";
import React, { useState, Suspense, useEffect } from "react";
import PluginErrorBoundary from "./PluginErrorBoundary";

const DynamicPlugins = () => {
  const [pages, setPages] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [mountKey, setMountKey] = useState(0);

  const ActivePlugin =
    activeId && pages[activeId] ? pages[activeId].component : null;

  const discover = async () => {
    console.log("[DynamicPlugins] calling discoverFederatedPlugins");
    const discovered = await discoverFederatedPlugins();
    console.log("[DynamicPlugins] result:", discovered);
    setPages(discovered || {});
  };

  /* const activatePlugin = async (id) => {
    const plugin = pages[id]?._raw;
    if (plugin) {
      const componentName = plugin.slug.split("/")[1].replace("-", "_");
      evictFederatedPlugin({
        id,
        componentName,
        remoteUrl: plugin.remoteUrl,
      });

      const fresh = await discoverFederatedPlugins();
      setPages(fresh || {});

      setActiveId(null);
      setTimeout(() => {
        setActiveId(id);
        setMountKey((k) => k + 1);
      }, 0);
    } else {
      setActiveId(id);
      setMountKey((k) => k + 1);
    }
  }; */
  const activatePlugin = async (id) => {
    const plugin = pages[id]?._raw;
    const alreadyLoaded = federationCache?.has?.(id);

    if (plugin && alreadyLoaded) {
      const componentName = plugin.slug.split("/")[1].replace("-", "_");
      evictFederatedPlugin({ id, componentName, remoteUrl: plugin.remoteUrl });
      const fresh = await discoverFederatedPlugins();
      setPages(fresh || {});
      setActiveId(null);
      setTimeout(() => {
        setActiveId(id);
        setMountKey((k) => k + 1);
      }, 0);
    } else {
      setActiveId(id);
      setMountKey((k) => k + 1);
    }
  };

  useEffect(() => {
    console.log(`New active plugin: ${activeId}`);
  }, [activeId]);

  return (
    <div>
      <h1>React Module Federation Plugins</h1>
      <button onClick={discover}>Discover</button>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {Object.entries(pages).map(([id, p]) => (
          <button key={id} onClick={() => activatePlugin(id)}>
            Navigate to {p.name}
          </button>
        ))}
      </div>

      {ActivePlugin ? (
        <div style={{ marginTop: 24 }}>
          <PluginErrorBoundary
            key={`${activeId}-${mountKey}`}
            onReset={() => activatePlugin(activeId)}
          >
            <Suspense fallback={<div>Loading Plugin...</div>}>
              <ActivePlugin key={`${activeId}-${mountKey}`} />
            </Suspense>
          </PluginErrorBoundary>
        </div>
      ) : (
        <div style={{ marginTop: 24, color: "#666" }}>
          No plugin active. Select one above.
        </div>
      )}
    </div>
  );
};

export default DynamicPlugins;
