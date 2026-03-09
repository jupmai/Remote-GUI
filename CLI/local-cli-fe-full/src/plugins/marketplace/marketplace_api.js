const API_URL = window._env_?.REACT_APP_API_URL || "http://localhost:8000";

// ── Marketplace catalogue ─────────────────────────────────────────────────────

/**
 * GET /marketplace/plugins
 * Returns catalogue entries merged with live plugin state from plugins_router.
 */
export const getMarketplacePlugins = async () => {
  const response = await fetch(`${API_URL}/marketplace/plugins`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

// Keep old name as alias for any existing callers
export const getPlugins = getMarketplacePlugins;

// ── Plugin lifecycle (mirrors plugins_router.py endpoints) ───────────────────

const post = (path, body) =>
  fetch(`${API_URL}/marketplace/plugins/${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    return data;
  });

/**
 * Build the plugin (prod) or mark it installed (dev).
 * This is the slow operation — takes 15-30 s in prod.
 */
export const installPlugin  = (pluginId) => post('install',   { plugin_id: pluginId });

/**
 * Delete build artefacts (prod) or remove from installed list (dev).
 */
export const uninstallPlugin = (pluginId) => post('uninstall', { plugin_id: pluginId });

/**
 * Mount / activate the plugin so it appears in the app (prod),
 * or start its webpack dev-server (dev).
 */
export const startPlugin = (pluginId) => post('start', { plugin_id: pluginId });

/**
 * Unmount / hide the plugin from the app (prod),
 * or kill the webpack dev-server (dev).
 */
export const stopPlugin = (pluginId) => post('stop', { plugin_id: pluginId });

/**
 * Poll the live status of one plugin.
 */
export const getPluginStatus = async (pluginId) => {
  const res = await fetch(`${API_URL}/marketplace/plugins/status/${pluginId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
