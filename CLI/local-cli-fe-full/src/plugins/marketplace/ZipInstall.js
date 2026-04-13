import React, { useState, useEffect, useRef, useCallback } from "react";

const POLL_INTERVAL_MS = 1500;
const API_BASE = "http://localhost:8000";

const EMPTY_FORM = {
  name: "",
  slug: "",
  description: "",
  feExposedModule: "",
  apiPrefix: "",
  downloadLink: "",
};

const ZipInstall = ({ onInstallComplete }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState([]);
  const [status, setStatus] = useState(null); // null, sntalling, enabling, complete, failed, cancelled
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const enablePlugin = useCallback(
    async (slug) => {
      setStatus("enabling");
      setProgress((prev) => [...prev, "Enabling plugin"]);

      const res = await fetch(`${API_BASE}/plugins/enable`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setStatus("complete");
      setProgress((prev) => [...prev, "Plugin ready"]);
      setInstalling(false);
      if (onInstallComplete) onInstallComplete();
    },
    [onInstallComplete],
  );

  const pollStatus = useCallback(
    async (slug) => {
      try {
        const res = await fetch(
          `${API_BASE}/plugins/status/${encodeURIComponent(slug)}`,
        );
        const data = await res.json();

        if (data.progress) setProgress(data.progress);

        if (data.status === "complete") {
          stopPolling();
          try {
            await enablePlugin(slug);
          } catch (e) {
            setStatus("failed");
            setError(`Install succeeded but enable failed: ${e.message}`);
            setInstalling(false);
          }
        } else if (data.status === "failed") {
          setStatus("failed");
          setError(data.error || "Unknown error");
          setInstalling(false);
          stopPolling();
        } else if (data.status === "cancelled") {
          setStatus("cancelled");
          setInstalling(false);
          stopPolling();
        }
      } catch (e) {
        console.warn("Poll error:", e);
      }
    },
    [enablePlugin],
  );

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const isValid =
    form.name.trim() &&
    form.slug.trim() &&
    form.feExposedModule.trim() &&
    form.apiPrefix.trim() &&
    form.downloadLink.trim();

  const handleInstall = async () => {
    if (!isValid || installing) return;

    setInstalling(true);
    setProgress([]);
    setStatus("installing");
    setError(null);

    const body = {
      plugin: {
        core: {
          name: form.name.trim(),
          slug: form.slug.trim(),
          version: "0.0.1",
          description: form.description.trim(),
          manifest: {
            minPyVersion: "0.0.1",
            feExposedModule: form.feExposedModule.trim(),
            api_prefix: form.apiPrefix.trim(),
          },
        },
        download_link: form.downloadLink.trim(),
        bundle_size_bytes: 0,
      },
    };

    try {
      const installRes = await fetch(`${API_BASE}/plugins/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!installRes.ok) {
        const data = await installRes.json();
        throw new Error(data.error || `HTTP ${installRes.status}`);
      }

      pollRef.current = setInterval(
        () => pollStatus(form.slug.trim()),
        POLL_INTERVAL_MS,
      );
    } catch (e) {
      setStatus("failed");
      setError(e.message);
      setInstalling(false);
    }
  };

  const handleReset = () => {
    stopPolling();
    setForm(EMPTY_FORM);
    setStatus(null);
    setProgress([]);
    setError(null);
    setInstalling(false);
  };

  useEffect(() => () => stopPolling(), []);

  const statusColor = {
    installing: "#2563eb",
    enabling: "#7c3aed",
    complete: "#16a34a",
    failed: "#dc2626",
    cancelled: "#9ca3af",
  }[status];

  const statusLabel = {
    installing: "Installing…",
    enabling: "Enabling plugin…",
    complete: "Installed and enabled",
    failed: `Failed: ${error}`,
    cancelled: "Cancelled",
  }[status];

  return (
    <div style={panelStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "4px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: "700",
              color: "#111827",
            }}
          >
            Install from ZIP
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#6b7280" }}>
            Provide plugin details and a direct download URL to a ZIP file.
          </p>
        </div>
        {status && (
          <button onClick={handleReset} style={resetBtnStyle} title="Reset">
            ✕
          </button>
        )}
      </div>

      <div
        style={{
          marginTop: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div style={rowStyle}>
          <Field
            label="Name"
            placeholder="chat-plugin"
            value={form.name}
            onChange={handleChange("name")}
            disabled={installing}
          />
          <Field
            label="Slug"
            placeholder="dev/chat-plugin"
            value={form.slug}
            onChange={handleChange("slug")}
            disabled={installing}
          />
        </div>

        <div style={rowStyle}>
          <Field
            label="FE Exposed Module"
            placeholder="MCPPage.js"
            value={form.feExposedModule}
            onChange={handleChange("feExposedModule")}
            disabled={installing}
          />
          <Field
            label="API Prefix"
            placeholder="/anylogmcp"
            value={form.apiPrefix}
            onChange={handleChange("apiPrefix")}
            disabled={installing}
          />
        </div>

        <Field
          label="Description"
          placeholder="Short description of the plugin"
          value={form.description}
          onChange={handleChange("description")}
          disabled={installing}
          optional
        />

        <div style={{ ...rowStyle, alignItems: "flex-end" }}>
          <Field
            label="Download URL"
            placeholder="http://localhost:8081/chat-plugin.zip"
            value={form.downloadLink}
            onChange={handleChange("downloadLink")}
            disabled={installing}
            style={{ flex: 3 }}
          />
          <button
            onClick={handleInstall}
            disabled={!isValid || installing}
            style={installBtnStyle(!isValid || installing)}
          >
            {installing ? (
              <span
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Spinner color="#fff" /> Installing…
              </span>
            ) : (
              "Install"
            )}
          </button>
        </div>
      </div>

      {status && (
        <div
          style={{
            marginTop: "16px",
            paddingTop: "14px",
            borderTop: "1px solid #f3f4f6",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              fontWeight: "600",
              color: statusColor,
              marginBottom: progress.length > 0 ? "10px" : 0,
            }}
          >
            {(status === "installing" || status === "enabling") && (
              <Spinner color={statusColor} />
            )}
            {statusLabel}
          </div>

          {progress.length > 0 && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "5px" }}
            >
              {progress.map((msg, i) => {
                const isLast =
                  i === progress.length - 1 &&
                  (status === "installing" || status === "enabling");
                const isDone = status === "complete" || i < progress.length - 1;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      color: isLast ? "#111827" : "#6b7280",
                      fontWeight: isLast ? "600" : "400",
                    }}
                  >
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        flexShrink: 0,
                        backgroundColor: isDone
                          ? "#16a34a"
                          : isLast
                            ? statusColor
                            : "#d1d5db",
                      }}
                    />
                    {msg}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Field = ({
  label,
  placeholder,
  value,
  onChange,
  disabled,
  optional,
  style,
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      flex: 1,
      ...style,
    }}
  >
    <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>
      {label}
      {optional && (
        <span
          style={{ fontWeight: "400", color: "#9ca3af", marginLeft: "4px" }}
        >
          (optional)
        </span>
      )}
    </label>
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{
        padding: "9px 12px",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
        fontSize: "13px",
        outline: "none",
        backgroundColor: disabled ? "#f9fafb" : "#fff",
        color: "#111827",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        width: "100%",
        boxSizing: "border-box",
      }}
    />
  </div>
);

const Spinner = ({ color = "#2563eb" }) => {
  useEffect(() => {
    if (!document.getElementById("zip-panel-spin")) {
      const s = document.createElement("style");
      s.id = "zip-panel-spin";
      s.textContent = `@keyframes zip-spin { to { transform: rotate(360deg); } }`;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <span
      style={{
        display: "inline-block",
        width: "11px",
        height: "11px",
        border: `2px solid ${color}33`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "zip-spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
};

const panelStyle = {
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "20px 24px",
  marginBottom: "28px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

const rowStyle = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const installBtnStyle = (disabled) => ({
  padding: "9px 22px",
  borderRadius: "8px",
  border: "none",
  backgroundColor: disabled ? "#e5e7eb" : "#111827",
  color: disabled ? "#9ca3af" : "#fff",
  fontWeight: "600",
  fontSize: "13px",
  cursor: disabled ? "not-allowed" : "pointer",
  whiteSpace: "nowrap",
  alignSelf: "flex-end",
  height: "38px",
  display: "flex",
  alignItems: "center",
});

const resetBtnStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#9ca3af",
  fontSize: "16px",
  padding: "2px 6px",
  borderRadius: "6px",
  lineHeight: 1,
};

export default ZipInstall;
