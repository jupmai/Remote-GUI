/* global __webpack_share_scopes__, __webpack_init_sharing__, __webpack_require__ */

import React from "react";

const API_URL =
  window._env_?.REACT_APP_API_URL ||
  (window.location.port === "8000" || window.location.port === ""
    ? window.location.origin
    : "http://localhost:8000");

export const federationCache = new Map();
const injectingScripts = new Map();

let cachedPluginOrder = null;
let orderFetchPromise = null;


const extractSlugComponents = (slugString) => {
  const slugElements = slugString.split("/")
  if (slugElements.length < 2) {
    throw new Error("Invalid slug")
  }

  return {
    reg: slugElements.length > 3 ? slugElements[slugElements.length - 3] : null,
    org: slugElements[slugElements.length - 2],
    pluginName: slugElements[slugElements.length - 1],
  }
}

// Dev mode: require.context loader

/**
 * Synchronously discover plugin pages by scanning the plugins/ folder.
 * Each plugin must export `pluginMetadata` from its Page file.
 *
 * @returns {{ [pluginName]: { component, path, name, icon } }}
 */
export const discoverPluginPages = () => {
  const pluginPages = {};

  // Matches:  ./pluginname/PluginnamePage.js   (capitalised Page filename)
  const pluginContext = require.context(
    "./",
    true,
    /^\.\/[^/]+\/[A-Z][^/]*Page\.js$/,
  );

  pluginContext.keys().forEach((modulePath) => {
    try {
      const pathParts = modulePath.split("/");
      const pluginName = pathParts[1];
      const pageFile = pathParts[2];

      if (pluginPages[pluginName]) return; // already loaded

      const mod = pluginContext(modulePath);
      const metadata = mod.pluginMetadata || {};

      const PluginPage = React.lazy(() =>
        import(`./${pluginName}/${pageFile.replace(/\.js$/, "")}`).catch(
          () => ({
            default: () => (
              <div style={{ padding: 20 }}>
                <h2>Plugin Error</h2>
                <p>
                  The <code>{pluginName}</code> plugin could not be loaded.
                </p>
              </div>
            ),
          }),
        ),
      );

      pluginPages[pluginName] = {
        component: PluginPage,
        path: pluginName,
        name: metadata.name || formatPluginName(pluginName),
        icon: metadata.icon || null,
        _source: "local",
      };
    } catch (err) {
      console.warn(
        `[PluginLoader] Failed to load plugin from ${modulePath}:`,
        err,
      );
    }
  });

  console.log(pluginPages);

  return pluginPages;
};

const injectScript = (url) => {
  if (injectingScripts.has(url)) return injectingScripts.get(url);

  const promise = new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = url;
    s.type = "text/javascript";
    s.async = true;
    s.onload = resolve;
    s.crossOrigin = "anonymous";
    s.onerror = () =>
      reject(new Error(`[PluginLoader] Failed to load script: ${url}`));
    document.head.appendChild(s);
  }).finally(() => injectingScripts.delete(url));

  injectingScripts.set(url, promise);
  return promise;
};

function resolveRemoteUrl(remoteUrl) {
  if (remoteUrl.startsWith("http")) return remoteUrl;
  return `${API_URL}${remoteUrl}`;
}

export const loadFederatedComponent = async ({
  id,
  componentName,
  remoteUrl,
  exposedModule = "./PluginApp",
}) => {
  console.log(
    "[MF] federationCache state on load:",
    id,
    federationCache.has(id),
  );
  console.log("[MF] loadFederatedComponent START", id);

  try {
    if (federationCache.has(id)) {
      console.log("[MF] returning from cache");
      return federationCache.get(id);
    }

    const resolvedUrl = resolveRemoteUrl(remoteUrl);
    await __webpack_init_sharing__("default");
    console.log("[MF] sharing initialized");

    if (!window[componentName]) await injectScript(resolvedUrl);
    console.log("[MF] script ready");

    const container = window[componentName];
    if (!container.__initialized) {
      await container.init(__webpack_share_scopes__.default);
      container.__initialized = true;
    }
    console.log("[MF] container initialized");

    const factory = await container.get(exposedModule);
    console.log("[MF] got factory");

    const mod = factory();
    console.log("[MF] got mod", mod);

    const component = mod.default ?? mod;
    console.log("[MF] got component", component);

    federationCache.set(id, component);
    return component;
  } catch (err) {
    console.error("[MF] loadFederatedComponent ERROR", err);
    throw err;
  }
};

export const fullEvictPlugin = async (id, componentName, remoteUrl) => {
  console.log("[Evict] Starting full eviction for:", id, componentName);

  const resolvedUrl = resolveRemoteUrl(remoteUrl);
  const pluginOrigin = new URL(resolvedUrl).pathname
    .split("/")
    .slice(0, -1)
    .join("/");

  const allScripts = Array.from(document.querySelectorAll("script[src]"));
  const pluginScripts = allScripts.filter((s) => s.src.includes(pluginOrigin));

  console.log(
    "[Evict] Found plugin scripts:",
    pluginScripts.map((s) => s.src),
  );

  await Promise.all(
    pluginScripts.map((script) => {
      const url = script.src;
      script.remove();
      return fetch(url, { cache: "reload" }).catch(() => {});
    }),
  );

  const entry = document.querySelector(`script[src="${resolvedUrl}"]`);
  if (entry) entry.remove();

  try {
    delete window[componentName];
  } catch {
    window[componentName] = undefined;
  }

  federationCache.delete(id);

  console.log(
    "[Evict] Done - browser cache busted for",
    pluginScripts.length,
    "chunks",
  );
};

export const evictFederatedPlugin = ({ id, componentName, remoteUrl }) => {
  const resolvedUrl = remoteUrl.startsWith("http")
    ? remoteUrl
    : `${API_URL}${remoteUrl}`;

  const existing = document.querySelector(`script[src="${resolvedUrl}"]`);
  if (existing) existing.remove();

  try {
    delete window[componentName];
  } catch {
    window[componentName] = undefined;
  }

  federationCache.delete(id);
};

export const discoverFederatedPlugins = async () => {
  const res = await fetch(`${API_URL}/plugins`);
  const plugins = await res.json();

  console.log(`PLUGINS:`);
  console.log(plugins);

  const pages = {};

  for (const plugin of plugins) {
    const { id, name, slug, remoteUrl, exposedModule = "./PluginApp" } = plugin;

    const slugComponents = extractSlugComponents(slug);
    const componentName = slugComponents.pluginName.replace("-", "_");
    // const slugElements = slug.split("/")
    // const componentName = slugElements[slugElements.length - 2].replace("-", "_");
    // const componentName = slug.split("/")[1].replace("-", "_");

    const PluginPage = React.lazy(() =>
      loadFederatedComponent({ id, componentName, remoteUrl, exposedModule })
        .then((comp) => ({ default: comp }))
        .catch(() => ({
          default: () => (
            <div style={{ padding: 20 }}>
              <h2>Plugin Error</h2>
              <p>
                The <code>{id}</code> plugin failed to load via Module
                Federation.
              </p>
            </div>
          ),
        })),
    );

    pages[id] = {
      component: PluginPage,
      path: id,
      name: name || formatPluginName(id),
      icon: plugin.icon || null,
      _source: "federation",
      // pass through raw plugin info for the DevPanel if needed
      _raw: plugin,
    };
  }

  return pages;
};

// ─── Shared: ordering ────────────────────────────────────────────────────────

const fetchPluginOrder = async () => {
  if (cachedPluginOrder !== null) return cachedPluginOrder;
  if (orderFetchPromise) return orderFetchPromise;

  orderFetchPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/plugins/order`);
      if (res.ok) {
        const data = await res.json();
        cachedPluginOrder = data.plugin_order || [];
        return cachedPluginOrder;
      }
    } catch {
      // endpoint is optional — fall back to alphabetical
    }
    cachedPluginOrder = [];
    return cachedPluginOrder;
  })();

  return orderFetchPromise;
};

const sortPluginsByOrder = (plugins, order) => {
  if (!plugins || typeof plugins !== "object") return [];
  if (!order?.length) {
    return Object.keys(plugins)
      .sort()
      .map((key) => ({ key, plugin: plugins[key] }));
  }

  const ordered = [];
  const remaining = new Set(Object.keys(plugins));

  for (const name of order) {
    if (plugins[name]) {
      ordered.push({ key: name, plugin: plugins[name] });
      remaining.delete(name);
    }
  }

  for (const name of Array.from(remaining).sort()) {
    ordered.push({ key: name, plugin: plugins[name] });
  }

  return ordered;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Synchronous — returns pages discovered from local files (dev) or the
 * last-known federation snapshot.
 *
 * Dashboard uses this for its initial render; call `refreshPluginPages()`
 * to pull a fresh federation snapshot and trigger a re-render.
 */
export const getPluginPages = () => {
  // const pages = IS_FEDERATION_MODE ? {} : discoverPluginPages();
  const pages = discoverPluginPages();
  const order = cachedPluginOrder || [];

  if (cachedPluginOrder === null && !orderFetchPromise) {
    fetchPluginOrder();
  }

  const sorted = sortPluginsByOrder(pages, order);
  const sortedObj = {};
  for (const { key, plugin } of sorted) sortedObj[key] = plugin;
  return sortedObj;
};

/**
 * Async — re-fetches the backend plugin list and returns an up-to-date
 * pages map regardless of mode.
 */
export const refreshPluginPages = async () => {
  const order = await fetchPluginOrder();

  let federatedPages = {};
  try {
    federatedPages = await discoverFederatedPlugins();
  } catch (err) {
    console.warn("[PluginLoader] Federation discovery failed:", err.message);
  }

  let localPages = {};
  try {
    localPages = discoverPluginPages();
  } catch (err) {
    console.warn("[PluginLoader] Local plugin discovery failed:", err.message);
  }

  const pages = { ...localPages, ...federatedPages };
  const sorted = sortPluginsByOrder(pages, order);
  const result = {};
  for (const { key, plugin } of sorted) result[key] = plugin;
  return result;
};

export const getPluginSidebarItems = (pages) => {
  const resolvedPages = pages ?? getPluginPages();
  const order = cachedPluginOrder || [];
  const sorted = sortPluginsByOrder(resolvedPages, order);
  return sorted.map(({ plugin }) => ({
    path: plugin.path,
    name: plugin.name,
    icon: plugin.icon,
  }));
};

/**
 * Initialise the order cache early (call in index.js / bootstrap.js).
 */
export const initializePluginOrder = () => Promise.resolve(fetchPluginOrder());

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatPluginName = (name) =>
  name
    .replace(/([A-Z])/g, " $1")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
