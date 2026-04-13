// src/components/Sidebar.js
import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  getPluginSidebarItems,
  initializePluginOrder,
} from "../plugins/loader";
import {
  fetchFeatureConfig,
  initializeFeatureConfig,
  isFeatureEnabled,
  isPluginEnabled,
} from "../services/featureConfig";
import "../styles/Sidebar.css";

const Sidebar = () => {
  const [pluginItems, setPluginItems] = useState(() => getPluginSidebarItems());
  const [enabledFeatures, setEnabledFeatures] = useState(new Set());
  const [enabledPlugins, setEnabledPlugins] = useState(new Set());
  const [installedPlugins, setInstalledPlugins] = useState([]);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [featureConfig, setFeatureConfig] = useState([]);

  useEffect(() => {
    const fetchConfigOnLoad = async () => {
      const config = await fetchFeatureConfig();

      console.log(`Raw config:`);
      console.log(config);

      if (config) {
        const transformedFeatures = Object.entries(config.features || {}).map(
          ([key, feature]) => ({
            path: key,
            name: key[0].toUpperCase() + key.slice(1),
            featureKey: key,
          }),
        );

        console.log("Feature config:");
        console.log(transformedFeatures);
        setFeatureConfig(transformedFeatures);
      }

      await Promise.all([initializeFeatureConfig(), initializePluginOrder()]);

      const enabled = new Set();
      for (const [featureKey, featureData] of Object.entries(
        config.features || {},
      )) {
        if (await isFeatureEnabled(featureKey)) {
          enabled.add(featureKey);
        }
      }
      setEnabledFeatures(enabled);

      const allPluginItems = getPluginSidebarItems();
      const enabledPluginItems = [];
      const enabledPluginSet = new Set();

      for (const plugin of allPluginItems) {
        if (await isPluginEnabled(plugin.path)) {
          enabledPluginItems.push(plugin);
          enabledPluginSet.add(plugin.path);
        }
      }

      setEnabledPlugins(enabledPluginSet);
      setPluginItems(enabledPluginItems);
      setConfigLoaded(true);
    };
    fetchConfigOnLoad();
  }, []);

  useEffect(() => {
    const findInstalledPlugins = async () => {
      const fetchPlugins = async () => {
        const res = await fetch("http://localhost:8000/plugins");
        return res.json();
      };

      const fetchConfig = async () => {
        const res = await fetch("http://localhost:8000/feature-config");
        return res.json();
      };

      try {
        const [pluginsList, featureConfig] = await Promise.all([
          fetchPlugins(),
          fetchConfig(),
        ]);

        const enabledConfigKeys = Object.entries(featureConfig.plugins)
          .filter(([key, value]) => key.includes("/") && value.enabled === true)
          .map(([key]) => key);

        const activePlugins = pluginsList.filter((p) => {
          const normalizedSlug = p.slug.replace("_", "-");

          return enabledConfigKeys.includes(normalizedSlug);
        });

        console.log("Enabled Plugins with '/':", activePlugins);

        setInstalledPlugins(activePlugins);
      } catch (error) {
        console.error("Failed to load startup data:", error);
      }
    };

    findInstalledPlugins();

    const interval = setInterval(() => {
      // return;
      findInstalledPlugins();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const visibleFeatures = featureConfig.filter((feature) =>
    enabledFeatures.has(feature.featureKey),
  );

  const visiblePlugins = pluginItems.filter((plugin) =>
    enabledPlugins.has(plugin.path),
  );

  return (
    <nav className="sidebar">
      {visibleFeatures.map((feature) => (
        <NavLink
          key={feature.path}
          to={feature.path}
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          {feature.name}
        </NavLink>
      ))}

      {configLoaded && visiblePlugins.length > 0 && (
        <div className="plugin-section">
          {visiblePlugins.map((plugin) => (
            <NavLink
              key={plugin.path}
              to={plugin.path}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {plugin.icon && `${plugin.icon} `}
              {plugin.name}
            </NavLink>
          ))}
        </div>
      )}

      {configLoaded && installedPlugins.length > 0 && (
        <div className="installed-plugin-section">
          {installedPlugins.map((plugin) => (
            <NavLink
              key={plugin.remoteUrl}
              // to={plugin.remoteUrl}
              to={plugin.id}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {plugin.icon && `${plugin.icon} `}
              {plugin.name}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Sidebar;
