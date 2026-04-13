const API_URL = window._env_?.REACT_APP_API_URL || "http://localhost:8000";

export const getMarketplacePlugins = async () => {
  const response = await fetch(`${API_URL}/marketplace/plugins`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

export const getInstalledPlugins = async () => {
  try {
    const response = await fetch(`${API_URL}/plugins`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    return data;
  } catch (e) {
    throw new Error(`Failed parsing response: ${e}`);
  }
};

export const getPlugins = getMarketplacePlugins;

const post = (path, body) =>
  fetch(`${API_URL}/marketplace/plugins/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    return data;
  });

export const installPlugin = (pluginId) =>
  post("install", { plugin_id: pluginId });

export const uninstallPlugin = (pluginId) =>
  post("uninstall", { plugin_id: pluginId });

export const startPlugin = (pluginId) => post("start", { plugin_id: pluginId });

export const stopPlugin = (pluginId) => post("stop", { plugin_id: pluginId });

export const getPluginStatus = async (pluginId) => {
  const res = await fetch(`${API_URL}/marketplace/plugins/status/${pluginId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
