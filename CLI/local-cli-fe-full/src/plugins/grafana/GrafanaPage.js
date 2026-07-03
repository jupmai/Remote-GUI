import React, { useEffect, useMemo, useState } from 'react';
import './GrafanaPage.css';

const STORAGE_KEY = 'grafana-dashboard-tabs';

// Plugin metadata - used by the plugin loader
export const pluginMetadata = {
  name: 'Grafana',
  icon: null
};

const createTab = ({ name, url }) => ({
  id: `grafana-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: name.trim(),
  url: url.trim(),
});

const getStoredState = () => {
  if (typeof window === 'undefined') {
    return { tabs: [], activeTabId: null };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.tabs)) {
      return { tabs: [], activeTabId: null };
    }

    return {
      tabs: parsed.tabs
        .filter((tab) => tab?.id && tab?.name && tab?.url)
        .map((tab) => ({
          id: String(tab.id),
          name: String(tab.name),
          url: String(tab.url),
        })),
      activeTabId: parsed.activeTabId ? String(parsed.activeTabId) : null,
    };
  } catch (error) {
    console.error('Failed to load Grafana tabs:', error);
    return { tabs: [], activeTabId: null };
  }
};

const validateUrl = (url) => {
  const trimmed = url.trim();
  if (!trimmed) return 'Enter a Grafana dashboard URL.';
  if (!/^https?:\/\//i.test(trimmed)) {
    return 'Grafana URLs must start with http:// or https://.';
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'Grafana URLs must start with http:// or https://.';
    }
  } catch (error) {
    return 'Enter a valid HTTP or HTTPS URL.';
  }

  return '';
};

const deriveNameFromUrl = (url, fallbackNumber) => {
  try {
    const parsed = new URL(url);
    const pathName = parsed.pathname.split('/').filter(Boolean).pop();
    return pathName ? decodeURIComponent(pathName).slice(0, 48) : parsed.hostname;
  } catch (error) {
    return `Dashboard ${fallbackNumber}`;
  }
};

const GrafanaPage = () => {
  const storedState = useMemo(getStoredState, []);
  const [tabs, setTabs] = useState(storedState.tabs);
  const [activeTabId, setActiveTabId] = useState(storedState.activeTabId);
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardUrl, setDashboardUrl] = useState('');
  const [editingTabId, setEditingTabId] = useState(null);
  const [error, setError] = useState('');
  const [embedWarning, setEmbedWarning] = useState(false);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0] || null;

  useEffect(() => {
    if (tabs.length === 0 || tabs.some((tab) => tab.id === activeTabId)) return;
    setActiveTabId(tabs[0].id);
  }, [tabs, activeTabId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tabs,
        activeTabId: activeTab?.id || null,
      })
    );
  }, [tabs, activeTab]);

  useEffect(() => {
    setEmbedWarning(false);
  }, [activeTab?.id, activeTab?.url]);

  const resetForm = () => {
    setDashboardName('');
    setDashboardUrl('');
    setEditingTabId(null);
    setError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const trimmedUrl = dashboardUrl.trim();
    const validationMessage = validateUrl(trimmedUrl);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const trimmedName = dashboardName.trim() || deriveNameFromUrl(trimmedUrl, tabs.length + 1);

    if (editingTabId) {
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === editingTabId ? { ...tab, name: trimmedName, url: trimmedUrl } : tab
        )
      );
      setActiveTabId(editingTabId);
    } else {
      const newTab = createTab({ name: trimmedName, url: trimmedUrl });
      setTabs((currentTabs) => [...currentTabs, newTab]);
      setActiveTabId(newTab.id);
    }

    resetForm();
  };

  const handleEdit = (tab) => {
    setDashboardName(tab.name);
    setDashboardUrl(tab.url);
    setEditingTabId(tab.id);
    setError('');
  };

  const handleRemove = (tabId) => {
    setTabs((currentTabs) => {
      const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);
      if (tabId === activeTabId) {
        setActiveTabId(nextTabs[0]?.id || null);
      }
      return nextTabs;
    });

    if (editingTabId === tabId) {
      resetForm();
    }
  };

  const handleOpenActiveTab = () => {
    if (activeTab?.url) {
      window.open(activeTab.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="grafana-page">
      <header className="grafana-header">
        <div>
          <h2>Grafana</h2>
          {activeTab && <p>{activeTab.name}</p>}
        </div>
        <button type="button" className="grafana-secondary-button" onClick={handleOpenActiveTab} disabled={!activeTab}>
          Open in New Tab
        </button>
      </header>

      <form className="grafana-form" onSubmit={handleSubmit}>
        <div className="grafana-field grafana-name-field">
          <label htmlFor="grafana-dashboard-name">Tab name</label>
          <input
            id="grafana-dashboard-name"
            type="text"
            value={dashboardName}
            onChange={(event) => setDashboardName(event.target.value)}
            placeholder="Operations dashboard"
          />
        </div>
        <div className="grafana-field grafana-url-field">
          <label htmlFor="grafana-dashboard-url">Dashboard URL</label>
          <input
            id="grafana-dashboard-url"
            type="url"
            value={dashboardUrl}
            onChange={(event) => setDashboardUrl(event.target.value)}
            placeholder="https://grafana.example.com/d/..."
          />
        </div>
        <div className="grafana-form-actions">
          <button type="submit" className="grafana-primary-button">
            {editingTabId ? 'Update' : 'Add'}
          </button>
          {editingTabId && (
            <button type="button" className="grafana-secondary-button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="grafana-error" role="alert">
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
          {error}
        </div>
      )}

      {tabs.length === 0 && (
        <div className="grafana-empty-state">
          Add a Grafana HTTP or HTTPS dashboard URL to embed it here.
        </div>
      )}

      {tabs.length > 0 && (
        <>
          <div className="grafana-tabs" role="tablist" aria-label="Grafana dashboards">
            {tabs.map((tab) => (
              <div key={tab.id} className={`grafana-tab ${tab.id === activeTab?.id ? 'active' : ''}`}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab.id === activeTab?.id}
                  onClick={() => setActiveTabId(tab.id)}
                  title={tab.url}
                >
                  {tab.name}
                </button>
                <button type="button" className="grafana-tab-edit" onClick={() => handleEdit(tab)} aria-label={`Edit ${tab.name}`}>
                  Edit
                </button>
                <button type="button" className="grafana-tab-remove" onClick={() => handleRemove(tab.id)} aria-label={`Remove ${tab.name}`}>
                  ×
                </button>
              </div>
            ))}
          </div>

          {embedWarning && (
            <div className="grafana-warning" role="status">
              <button type="button" onClick={() => setEmbedWarning(false)} aria-label="Dismiss embed warning">×</button>
              If this dashboard stays blank, Grafana may be blocking iframe embedding. Enable <code>allow_embedding</code> in Grafana or use Open in New Tab.
            </div>
          )}

          {activeTab && (
            <section className="grafana-frame-shell" aria-label={`${activeTab.name} dashboard`}>
              <iframe
                key={activeTab.id}
                src={activeTab.url}
                title={`Grafana Dashboard - ${activeTab.name}`}
                className="grafana-frame"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                allow="fullscreen"
                onLoad={() => setEmbedWarning(false)}
                onError={() => setEmbedWarning(true)}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default GrafanaPage;
