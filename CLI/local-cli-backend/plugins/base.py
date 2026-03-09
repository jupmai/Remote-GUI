from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator
from pydantic.alias_generators import to_camel


class VersionInfo(BaseModel):
    major: int = Field(ge=0)
    minor: int = Field(ge=0)
    patch: int = Field(ge=0)

    @model_validator(mode="before")
    @classmethod
    def parse_version(cls, v):
        if isinstance(v, str):
            major, minor, patch = map(int, v.split("."))
            return {
                "major": major,
                "minor": minor,
                "patch": patch,
            }
        return v

    def __str__(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"

    def _tuple(self):
        return (self.major, self.minor, self.patch)

    def __gt__(self, other):
        if not isinstance(other, VersionInfo):
            return NotImplemented
        return self._tuple() > other._tuple()

    def __lt__(self, other):
        if not isinstance(other, VersionInfo):
            return NotImplemented
        return self._tuple() < other._tuple()

    def __eq__(self, other):
        if not isinstance(other, VersionInfo):
            return NotImplemented
        return self._tuple() == other._tuple()


class PluginManifest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    min_py_version: VersionInfo
    fe_exposed_module: str
    api_prefix: str


class PluginCore(BaseModel):
    name: str
    id: str
    description: str
    version: VersionInfo
    manifest: PluginManifest


class MarketplacePlugin(BaseModel):
    core: PluginCore
    download_link: HttpUrl
    download_count: int = 0
    rating: float = Field(0.0, ge=0, le=5)
    bundle_size_bytes: float


class InstalledPlugin(BaseModel):
    core: PluginCore
    install_path: Path
    installed_at: datetime = Field(default_factory=datetime.now)

    def write(self, at_path: Path, file_name: str):
        at_path.mkdir(exist_ok=True, parents=True)
        file = Path(at_path) / file_name

        file.write_text(self.model_dump_json())

    @classmethod
    def load(cls, fp: Path):
        if not fp.exists() or not fp.is_file():
            raise FileNotFoundError(f"Path {fp} not found")

        plugin_json_string = fp.read_text()
        return cls.model_validate_json(plugin_json_string)
