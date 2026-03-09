import asyncio
import os
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Optional

import aiofiles
from psutil import AccessDenied, NoSuchProcess, Process

from plugins.base import InstalledPlugin
from plugins.exceptions import PluginError, PluginNotFoundError, PluginNotRunningError

PLUGINS_PATH = (
    Path(os.path.dirname(os.path.abspath(__file__))).parent / "official-plugins"
)


class PluginEngine:
    def __init__(self):
        self.processes: Dict[str, asyncio.subprocess.Process] = {}
        self.plugins: Dict[str, InstalledPlugin] = {}

    def find_installed_plugins(self, plugins_path: Path) -> List[InstalledPlugin]:
        installed: List[InstalledPlugin] = []

        for root, _, files in os.walk(plugins_path):
            if "plugin_installation.json" in files:
                try:
                    file_path = Path(root) / "plugin_installation.json"
                    print(f"FOUND INSTALLATION: {file_path}")

                    installed.append(InstalledPlugin.load(file_path))
                except Exception:
                    continue

        return installed

    def get_installed_plugin_by_id(
        self, plugin_id: str, plugins_path: Path
    ) -> Optional[InstalledPlugin]:
        installed_plugins = self.find_installed_plugins(plugins_path)
        for plugin in installed_plugins:
            if plugin.core.id == plugin_id:
                return plugin
        return None

    async def start_plugin(self, installed_plugin: InstalledPlugin, port: int):
        try:
            self.plugins[installed_plugin.core.id] = installed_plugin

            backend_path = installed_plugin.install_path / "backend"

            venv_path = backend_path / ".venv"
            if not venv_path.exists():
                venv_proc = await asyncio.create_subprocess_exec(
                    "uv",
                    "venv",
                    cwd=backend_path,
                )
                venv_term_code = await venv_proc.wait()
                if venv_term_code != 0:
                    raise Exception("Failed to create environment for plugin")

            log_path = installed_plugin.install_path / "log.txt"
            log_file = open(log_path, "ab")

            setup_proc = await asyncio.create_subprocess_exec(
                "uv",
                "pip",
                "install",
                "-r",
                "requirements.txt",
                cwd=backend_path,
                stdout=log_file,
                stderr=log_file,
            )
            setup_term_code = await setup_proc.wait()
            if setup_term_code != 0:
                raise Exception("Failed to install backend dependencies for plugin")

            proc = await asyncio.create_subprocess_exec(
                "uv",
                "run",
                "uvicorn",
                "main:app",
                "--port",
                str(port),
                stdout=log_file,
                stderr=log_file,
                cwd=backend_path,
            )

            self.processes[installed_plugin.core.id] = proc

            asyncio.create_task(
                self._watch_plugin(installed_plugin.core.id, proc, log_file)
            )

        except Exception as e:
            raise PluginError(f"Unable to start plugin: {e}")

    async def stop_plugin(self, plugin_id: str, timeout: float = 5.0):
        proc = self.processes.get(plugin_id)
        if not proc:
            return

        proc.terminate()
        try:
            await asyncio.wait_for(proc.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()

        self.processes.pop(plugin_id, None)

    async def restart_plugin(self, installed_plugin: InstalledPlugin, port: int):
        if installed_plugin.core.id in self.processes:
            await self.stop_plugin(installed_plugin.core.id)
        await self.start_plugin(installed_plugin, port)

    def plugin_running(self, plugin_id: str) -> bool:
        proc = self.processes.get(plugin_id)
        if not proc:
            return False
        return proc.returncode is None

    async def _watch_plugin(
        self, plugin_id: str, proc: asyncio.subprocess.Process, log_file
    ):
        try:
            await proc.wait()
        finally:
            log_file.close()
            self.processes.pop(plugin_id, None)
            self.plugins.pop(plugin_id, None)

    def get_plugin_log_path(self, plugin_id: str) -> Path:
        active_plugin = self.plugins.get(plugin_id)
        if not active_plugin:
            print(f"PLUGINS PATH: {PLUGINS_PATH}")
            installed = self.get_installed_plugin_by_id(plugin_id, PLUGINS_PATH)
            if installed is None:
                raise PluginNotFoundError(plugin_id)
            raise PluginNotRunningError(installed)
        return Path(active_plugin.install_path) / "log.txt"

    def open_plugin_log(self, plugin_id: str, mode: str = "r"):
        log_path = self.get_plugin_log_path(plugin_id)
        return open(log_path, mode)

    async def stream_log(self, plugin_id: str) -> AsyncGenerator[Dict, None]:
        log_path = self.get_plugin_log_path(plugin_id)
        async with aiofiles.open(log_path, mode="r") as f:
            await f.seek(0, 2)
            while self.plugin_running(plugin_id):
                line = await f.readline()
                if line:
                    yield {
                        "log": line.rstrip(),
                        "metrics": self.get_metrics(plugin_id),
                    }
                else:
                    yield {"metrics": self.get_metrics(plugin_id)}
                    await asyncio.sleep(0.5)

            yield {"log": "Plugin not running"}

    def get_metrics(self, plugin_id: str) -> Optional[Dict[str, float]]:
        running_proc = self.processes.get(plugin_id)
        if not running_proc or running_proc.returncode is not None:
            return None

        try:
            parent = Process(running_proc.pid)

            all_processes = [parent] + parent.children(recursive=True)

            total_cpu = 0.0
            total_rss = 0.0

            for p in all_processes:
                try:
                    total_cpu += p.cpu_percent(interval=None)
                    total_rss += p.memory_info().rss
                except (NoSuchProcess, AccessDenied):
                    continue

            return {"cpu_percent": total_cpu, "memory_mb": total_rss / (1024 * 1024)}
        except NoSuchProcess:
            return None


_engine: PluginEngine | None = None


def get_plugin_engine() -> PluginEngine:
    global _engine
    if _engine is None:
        _engine = PluginEngine()

    return _engine
