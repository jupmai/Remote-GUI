import asyncio
import os
import shutil
import zipfile
from pathlib import Path
from typing import Awaitable, Callable, Optional

import aiofile
import httpx

from feature_config_loader import delete_plugin_feature, enable_plugin_feature
from plugins import manager
from plugins.base import InstalledPlugin, MarketplacePlugin
from plugins.exceptions import InstallError, InvalidPluginStructureError
from plugins.template import CRACO_CONFIG

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def write_plugin_craco(slug: str, entryFileName: str, filepath: Path):
    _, plugin_name = slug.split("/")
    with open(filepath / "craco.config.js", "w") as f:
        formatted = CRACO_CONFIG.substitute(
            plugin_name=plugin_name.replace("-", "_"),
            entryFile=entryFileName,
            plugin_mount_fe_url=f"http://localhost:8000/official-plugins/{slug}/frontend/build/",
        )
        f.write(formatted)


async def install_plugin(
    plugin: MarketplacePlugin,
    plugins_path: str,
    on_progress: Optional[Callable[[str], Awaitable[None]]],
) -> InstalledPlugin:
    loop = asyncio.get_event_loop()

    plugins_basepath = Path(plugins_path)
    plugins_basepath.mkdir(parents=True, exist_ok=True)

    plugin_path = plugins_basepath.joinpath(plugin.core.slug)
    plugin_path.mkdir(parents=True, exist_ok=True)

    if on_progress:
        await on_progress("Downloading plugin contents")

    print(f"Attempting download: {repr(str(plugin.download_link))}")

    async with httpx.AsyncClient(follow_redirects=True) as client:
        async with client.stream("GET", str(plugin.download_link)) as resp:
            resp.raise_for_status()
            async with aiofile.async_open(plugin_path / "file.zip", "wb") as f:
                async for chunk in resp.aiter_bytes():
                    await f.write(chunk)

    if on_progress:
        await on_progress("Extracting plugin contents")

    # with zipfile.ZipFile(plugin_path.joinpath("file.zip"), "r") as z:
    #     z.extractall(plugin_path)
    def extract_zip():
        with zipfile.ZipFile(plugin_path / "file.zip", "r") as z:
            z.extractall(plugin_path)
        os.remove(plugin_path / "file.zip")

    await loop.run_in_executor(None, extract_zip)

    if on_progress:
        await on_progress("Validating plugin structure")
    backend_path, frontend_path = plugin_path / "backend", plugin_path / "frontend"
    if not backend_path.exists():
        raise InvalidPluginStructureError(plugin, plugins_basepath, missing=["backend"])

    if not frontend_path.exists():
        raise InvalidPluginStructureError(
            plugin, plugins_basepath, missing=["frontend"]
        )

    write_plugin_craco(
        slug=plugin.core.slug,
        entryFileName=plugin.core.manifest.fe_exposed_module,
        filepath=frontend_path,
    )

    if on_progress:
        await on_progress("Installing plugin UI dependencies")

    fe_build_log = Path(frontend_path / "build.log")
    with open(fe_build_log, "w") as f:
        install_fe_proc = await asyncio.create_subprocess_exec(
            "npm",
            "install",
            "--legacy-peer-deps",
            # stdout=asyncio.subprocess.DEVNULL,
            # stderr=asyncio.subprocess.DEVNULL,
            stdout=f,
            stderr=f,
            cwd=frontend_path,
        )
        install_term_code = await install_fe_proc.wait()

        if install_term_code != 0:
            raise InstallError(
                "Failed installing plugin UI dependencies",
                core=plugin.core,
                install_path=plugin_path,
            )

        print("Installed plugin frontend dependencies")

        if on_progress:
            await on_progress("Building plugin UI")

        build_fe_proc = await asyncio.create_subprocess_exec(
            "npm",
            "run",
            "build",
            stdout=f,
            stderr=f,
            # stdout=asyncio.subprocess.DEVNULL,
            # stderr=asyncio.subprocess.DEVNULL,
            cwd=frontend_path,
        )
        build_term_code = await build_fe_proc.wait()

        if build_term_code != 0:
            raise InstallError(
                "Failed building plugin",
                core=plugin.core,
                install_path=plugin_path,
            )

        print("Built plugin frontend")
        if on_progress:
            await on_progress("Build plugin UI components")

    if on_progress:
        await on_progress("Finishing up")

    # shutil.rmtree(Path(frontend_path / "node_modules"))
    await loop.run_in_executor(None, shutil.rmtree, frontend_path / "node_modules")

    installed = InstalledPlugin(core=plugin.core, install_path=plugin_path)
    installed.write(plugin_path, "plugin_installation.json")

    enable_plugin_feature(plugin.core.slug)

    if on_progress:
        await on_progress("Completed")

    return installed


async def uninstall_plugin(installed: InstalledPlugin):
    if manager.get_plugin_engine().plugin_running(installed.core.slug):
        await manager.get_plugin_engine().stop_plugin(installed.core.slug)
    plugin_path = installed.install_path
    if not plugin_path.exists():
        raise FileNotFoundError(f"Plugin '{installed.core.slug}' not installed")
    shutil.rmtree(plugin_path, ignore_errors=True)

    dev_dir = installed.install_path.parent
    if dev_dir.exists() and len(os.listdir(dev_dir)) == 0:
        shutil.rmtree(dev_dir, ignore_errors=True)

    delete_plugin_feature(installed.core.slug)
