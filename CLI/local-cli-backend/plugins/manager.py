import socket

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

from plugins.base import InstalledPlugin
from plugins.engine import get_plugin_engine
from plugins.exceptions import PluginAppInitializationError

engine = get_plugin_engine()


class PluginManager:
    def __init__(self):
        self._app: FastAPI | None = None
        self._client = httpx.AsyncClient()

    def set_app(self, app: FastAPI):
        self._app = app

    def _alloc_port(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("", 0))
            return s.getsockname()[1]

    async def start_plugin(self, installed: InstalledPlugin):
        if not self._app:
            raise PluginAppInitializationError(
                "No FastAPI app registered within plugin manager"
            )

        port = self._alloc_port()

        await engine.start_plugin(installed_plugin=installed, port=port)
        self._register_route(installed.core.id, port)

    def _register_route(self, plugin_id: str, port: int):
        async def proxy_handler(path: str, request: Request):
            url = f"http://127.0.0.1:{port}/{path}"

            rp_req = self._client.build_request(
                method=request.method,
                url=url,
                params=request.query_params,
                headers={
                    k: v for k, v in request.headers.items() if k.lower() != "host"
                },
                content=await request.body(),
            )

            rp_resp = await self._client.send(rp_req, stream=True)
            return StreamingResponse(
                rp_resp.aiter_raw(),
                status_code=rp_resp.status_code,
                headers=dict(rp_resp.headers),
            )

        if self._app:
            self._app.add_api_route(
                path=f"/{plugin_id.replace('/', '-')}/{{path:path}}",
                endpoint=proxy_handler,
                methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
            )
            print(f"Linked {plugin_id.replace('/', '-')} to internal {port}")
        else:
            raise PluginAppInitializationError(
                "No FastAPI app registered within plugin manager"
            )


_manager: PluginManager | None = None


def get_plugin_manager() -> PluginManager:
    global _manager
    if _manager is None:
        _manager = PluginManager()

    return _manager
