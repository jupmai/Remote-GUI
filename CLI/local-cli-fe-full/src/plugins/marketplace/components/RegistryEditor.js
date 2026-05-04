import React, { useEffect, useState } from "react";

const RegistryEditor = ({onSave}) => {
  const STORAGE_KEY = "plugin-marketplace/registries/sources";

  const [registries, setRegistries] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const parsed = JSON.parse(stored);

      const normalized = parsed.map((item) =>
        typeof item === "string"
          ? { url: item, enabled: true }
          : { url: item.url || "", enabled: !!item.enabled }
      );

      setRegistries(normalized);
      setSelected(normalized.map(() => false));
    } else {
      const defaults = [
        {
          url: "http://localhost:8081/registry-manifest.json",
          enabled: true,
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      setRegistries(defaults);
      setSelected(defaults.map(() => false));
    }
  }, []);

  const toggleSelect = (index) => {
    const updated = [...selected];
    updated[index] = !updated[index];
    setSelected(updated);
  };

  const handleUrlChange = (index, value) => {
    const updated = [...registries];
    updated[index].url = value;
    setRegistries(updated);
  };

  const toggleEnabled = (index) => {
    const updated = [...registries];
    updated[index].enabled = !updated[index].enabled;
    setRegistries(updated);
  };

  const removeItem = (index) => {
    setRegistries(registries.filter((_, i) => i !== index));
    setSelected(selected.filter((_, i) => i !== index));
  };

  const removeSelected = () => {
    const filtered = registries.filter((_, i) => !selected[i]);
    setRegistries(filtered);
    setSelected(filtered.map(() => false));
  };

  const addItem = () => {
    setRegistries([...registries, { url: "", enabled: true }]);
    setSelected([...selected, false]);
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registries));
    onSave();
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Registry Sources</h2>

      {registries.map((item, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "8px",
          }}
        >
          <input
            type="checkbox"
            checked={selected[index] || false}
            onChange={() => toggleSelect(index)}
          />

          <input
            type="text"
            value={item.url}
            onChange={(e) => handleUrlChange(index, e.target.value)}
            placeholder="Registry URL"
            style={{ flex: 1 }}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={item.enabled}
              onChange={() => toggleEnabled(index)}
            />
            Enabled
          </label>

          <button onClick={() => removeItem(index)} style={{ color: "red" }}>
            Remove
          </button>
        </div>
      ))}

      <div style={{ marginTop: 15 }}>
        <button onClick={addItem}>Add</button>
        <button onClick={removeSelected} style={{ marginLeft: 10 }}>
          Remove Selected
        </button>
        <button onClick={save} style={{ marginLeft: 10 }}>
          Save
        </button>
      </div>
    </div>
  );
};

export default RegistryEditor;