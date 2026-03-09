import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, model_validator

import plugins
import plugins.exceptions
from decorators import wrap_sse_stream
from feature_config_loader import (
    disable_plugin_feature,
    enable_plugin_feature,
    load_feature_config,
    write_feature_config,
)
from plugins.base import MarketplacePlugin
from plugins.engine import get_plugin_engine
from plugins.installer import install_plugin, uninstall_plugin
from plugins.loader import get_plugin_order
from plugins.manager import get_plugin_manager

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OFFICIAL_PLUGINS_PATH = Path(BASE_DIR) / "official-plugins"

if not OFFICIAL_PLUGINS_PATH.exists():
    OFFICIAL_PLUGINS_PATH.mkdir(parents=True, exist_ok=True)

plugins_router = APIRouter(prefix="/plugins", tags=["feature-config"])
engine = get_plugin_engine()
manager = get_plugin_manager()


def get_plugin_order_config() -> dict:
    plugins_dir = os.path.join(BASE_DIR, "plugins")
    plugin_order = get_plugin_order(plugins_dir)
    return {
        "plugin_order": plugin_order if plugin_order else [],
        "has_custom_order": plugin_order is not None,
    }


class InstallRequest(BaseModel):
    plugin: MarketplacePlugin
    path: str = Field(default=str(OFFICIAL_PLUGINS_PATH))

    @model_validator(mode="before")
    @classmethod
    def flatten_plugin(cls, data):
        if "plugin" not in data:
            plugin_fields = {"name", "id", "version", "download_link"}
            if plugin_fields.issubset(data.keys()):
                data = dict(data)
                data["plugin"] = {k: data.pop(k) for k in plugin_fields}
        return data


class ModificationRequest(BaseModel):
    id: str


@plugins_router.get("/order")
def get_plugin_order_endpoint():
    return get_plugin_order_config()


@plugins_router.get("")
def get_main():
    return RedirectResponse("/plugins/", 301)
    # return load_feature_config()


@plugins_router.get("/")
async def return_plugins():
    # return [
    #     {
    #         "id": "plugin_a",
    #         "name": "plugin_a",
    #         "description": "A minimal test plugin.",
    #         "version": "1.0.0",
    #         # "port": 0000,
    #         # "built": True,
    #         # "running": True,
    #         # "ready": True,
    #         # "installed": True,
    #         "remoteUrl": "/plugin-builds/dev/calc-plugin/frontend/remoteEntry.js",
    #     }
    # ]
    installed_plugins = engine.find_installed_plugins(OFFICIAL_PLUGINS_PATH)
    return [
        {
            "id": plugin.core.name.replace("-", "_"),
            "name": plugin.core.name.replace("-", "_"),
            "version": plugin.core.version,
            "description": plugin.core.description,
            "remoteUrl": f"/official-plugins/{plugin.core.id}/frontend/build/remoteEntry.js",
        }
        for plugin in installed_plugins
    ]


@plugins_router.post("/install")
async def post_install_plugin(req: InstallRequest):
    try:
        installed = await install_plugin(req.plugin, req.path)

        config = load_feature_config()
        config["plugins"][req.plugin.core.name] = {
            "id": req.plugin.core.id,
            "enabled": True,
            "description": req.plugin.core.description,
        }
        write_feature_config(config)

        return installed
    except plugins.exceptions.InvalidPluginStructureError as e:
        raise HTTPException(400, f"Malformed plugin: {e.message}")


@plugins_router.post("/uninstall")
async def post_uninstall_plugin(req: ModificationRequest):
    try:
        installed = engine.find_installed_plugins(OFFICIAL_PLUGINS_PATH)
        for plugin in installed:
            if plugin.core.id == req.id:
                uninstall_plugin(plugin)
                return
        raise HTTPException(400, f"{req.id} not installed")
    except ValueError as e:
        raise HTTPException(400, str(e))
    except FileNotFoundError as e:
        raise HTTPException(400, str(e))


@plugins_router.patch("/enable")
async def enable_plugin(req: ModificationRequest):
    # try:
    installed = engine.find_installed_plugins(OFFICIAL_PLUGINS_PATH)
    for plugin in installed:
        if plugin.core.id == req.id:
            print("Starting plugin from engine")
            await manager.start_plugin(plugin)
            enable_plugin_feature(req.id)
    # except Exception as e:
    #     raise HTTPException(400, detail=str(e))


@plugins_router.patch("/disable")
async def disable_plugin(req: ModificationRequest):
    try:
        disable_plugin_feature(req.id)
    except Exception as e:
        raise HTTPException(400, detail=str(e))


@plugins_router.get("/installed")
async def list_plugins(req: Request):
    try:
        plugins = engine.find_installed_plugins(OFFICIAL_PLUGINS_PATH)
        return plugins
    except Exception:
        raise HTTPException(500, "Faild finding plugins")


@plugins_router.get("/logs")
@wrap_sse_stream
async def stream_plugin_log(req: Request, plugin_id: str = Query(...)):
    if "/" not in plugin_id:
        raise HTTPException(400, detail="Invalid plugin_id")

    engine = get_plugin_engine()

    try:
        gen = engine.stream_log(plugin_id)

        first_val = await gen.__anext__()

        async def yield_logs():
            yield first_val
            async for item in gen:
                yield item

        return yield_logs()
    except (
        plugins.exceptions.PluginNotFoundError,
        plugins.exceptions.PluginNotRunningError,
    ) as e:
        raise HTTPException(400, str(e))
