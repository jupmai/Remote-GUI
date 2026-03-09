"""
plugins/marketplace/marketplace_router.py

Auto-loaded by plugins/loader.py via load_plugins(app).
No changes to main.py needed.

GET /marketplace/plugins

Scans the frontend src/plugins/ directory for plugin folders and returns
a catalogue with live enabled/disabled state from feature_config.

A frontend plugin folder is identified by containing a capitalised *Page.js
file — the same pattern as loader.js's require.context regex.
"""

import json
import re
import sys
from pathlib import Path

from fastapi import APIRouter

# ── Resolve backend root so we can import feature_config_loader ───────────────
# This file lives at:  backend/plugins/marketplace/marketplace_router.py
# Backend root is:     backend/  →  Path(__file__).parent.parent.parent
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from feature_config_loader import load_feature_config  # noqa: E402

api_router = APIRouter(prefix="/marketplace", tags=["marketplace"])

# ── Locate frontend src/plugins/ ──────────────────────────────────────────────
# Typical layout:
#   project-root/
#     backend/          ← BACKEND_DIR
#     frontend/
#       src/
#         plugins/      ← FRONTEND_PLUGINS_DIR
#
# We try common frontend folder names; set FRONTEND_PLUGINS_DIR directly if
# your layout differs.

PROJECT_ROOT = BACKEND_DIR.parent

_CANDIDATES = [
    PROJECT_ROOT / "frontend" / "src" / "plugins",
    PROJECT_ROOT / "main-app" / "src" / "plugins",
    PROJECT_ROOT / "src" / "plugins",
    PROJECT_ROOT / "app" / "src" / "plugins",
]


def _find_frontend_plugins_dir() -> Path:
    for p in _CANDIDATES:
        if p.exists():
            return p
    return _CANDIDATES[0]  # primary; route returns [] if it doesn't exist


FRONTEND_PLUGINS_DIR = _find_frontend_plugins_dir()

# ── Helpers ───────────────────────────────────────────────────────────────────

_PAGE_RE = re.compile(r"^[A-Z][^/]*Page\.js$")


def _has_page_file(plugin_dir: Path) -> bool:
    return any(_PAGE_RE.match(f.name) for f in plugin_dir.iterdir() if f.is_file())


def _is_plugin_dir(path: Path) -> bool:
    """Same exclusion rules as loader.js require.context."""
    if not path.is_dir():
        return False
    if path.name.startswith((".", "_")) or path.name == "marketplace":
        return False
    return _has_page_file(path)


def _parse_version(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    parts = str(raw).split(".")

    def _i(s):
        return int(s) if s.isdigit() else 0

    return {
        "major": _i(parts[0]) if len(parts) > 0 else 0,
        "minor": _i(parts[1]) if len(parts) > 1 else 0,
        "patch": _i(parts[2]) if len(parts) > 2 else 0,
    }


def _format_name(folder_name: str) -> str:
    spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", folder_name)
    spaced = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", spaced)
    return spaced.strip().title()


def _read_metadata(plugin_dir: Path) -> dict:
    pj = plugin_dir / "plugin.json"
    if pj.exists():
        try:
            meta = json.loads(pj.read_text())
            return {
                "name": meta.get("name") or _format_name(plugin_dir.name),
                "description": meta.get("description") or "",
                "version": _parse_version(meta.get("version", "0.0.0")),
                "thumbnail": meta.get("thumbnail"),
                "plugin_link": meta.get("plugin_link"),
            }
        except Exception:
            pass
    return {
        "name": _format_name(plugin_dir.name),
        "description": "",
        "version": {"major": 0, "minor": 0, "patch": 0},
        "thumbnail": None,
        "plugin_link": None,
    }


# ── Route ─────────────────────────────────────────────────────────────────────


@api_router.get("/plugins")
def list_marketplace_plugins():
    """Returns all frontend plugins with their enabled state from feature_config."""
    if not FRONTEND_PLUGINS_DIR.exists():
        return []

    fc_plugins = load_feature_config().get("plugins", {})
    result = []

    for plugin_dir in sorted(FRONTEND_PLUGINS_DIR.iterdir()):
        if not _is_plugin_dir(plugin_dir):
            continue

        plugin_id = plugin_dir.name
        meta = _read_metadata(plugin_dir)
        fc_entry = fc_plugins.get(plugin_id)
        enabled = fc_entry.get("enabled", True) if isinstance(fc_entry, dict) else True

        result.append(
            {
                "id": plugin_id,
                "name": meta["name"],
                "description": meta["description"],
                "version": meta["version"],
                "thumbnail": meta["thumbnail"],
                "plugin_link": meta["plugin_link"],
                "enabled": enabled,
            }
        )

    return result
