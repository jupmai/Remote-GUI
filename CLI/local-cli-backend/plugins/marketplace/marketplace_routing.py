# from typing import List, Self

# from fastapi import APIRouter
# from pydantic import BaseModel, Field

# api_router = APIRouter(
#     prefix="/marketplace", tags=["Plugin Marketplace", "Marketplace"]
# )


# class PluginVersion(BaseModel):
#     major: int = Field(ge=0)
#     minor: int = Field(ge=0)
#     patch: int = Field(ge=0)

#     @classmethod
#     def try_from_str(cls, v_string) -> Self:
#         try:
#             major, minor, patch = map(int, v_string.split("."))
#             return cls(major=major, minor=minor, patch=patch)
#         except (ValueError, TypeError):
#             raise ValueError(
#                 f"{v_string} is not a valid version number(major, minor, patch)"
#             )

#     @classmethod
#     def from_str(cls, v_string: str) -> Self | None:
#         numberings = v_string.split(".")
#         if len(numberings) != 3 or not all(n.isdigit() for n in numberings):
#             return None

#         return cls(major=numberings[0], minor=numberings[1], patch=numberings[2])  # type:ignore

#     def __str__(self) -> str:
#         return f"{self.major}.{self.minor}.{self.patch}"

#     def _tuple(self):
#         return (self.major, self.minor, self.patch)

#     def __gt__(self, other):
#         if not isinstance(other, PluginVersion):
#             return NotImplemented
#         return self._tuple() > other._tuple()

#     def __lt__(self, other):
#         if not isinstance(other, PluginVersion):
#             return NotImplemented
#         return self._tuple() < other._tuple()

#     def __eq__(self, other):
#         if not isinstance(other, PluginVersion):
#             return NotImplemented
#         return self._tuple() == other._tuple()


# class SimplePlugin(BaseModel):
#     name: str
#     description: str
#     thumbnail: str
#     version: PluginVersion
#     plugin_link: str
#     download_link: str

#     def is_newer(self, plugin):
#         if not isinstance(plugin, SimplePlugin):
#             return NotImplemented
#         return self.version > plugin.version


# class Plugin(BaseModel):
#     simple: SimplePlugin
#     media: List[str] = []


# @api_router.get("/plugins")
# async def get_plugins():
#     plugins: List[SimplePlugin] = [
#         SimplePlugin(
#             name="calculator",
#             description="calculator description",
#             thumbnail="https://miro.medium.com/v2/resize:fit:800/1%2AzC_0Pkr4iFEbwbHhcG-dHw.png",
#             version=PluginVersion.from_str("0.0.1"),  # type:ignore
#             plugin_link="http://localhost:5000/plugins/calculator",
#             download_link="http://localhost:5000/plugins/calculator/download",
#         ),
#         SimplePlugin(
#             name="grafana",
#             description="grafana description",
#             thumbnail="https://miro.medium.com/v2/resize:fit:800/1%2AzC_0Pkr4iFEbwbHhcG-dHw.png",
#             version=PluginVersion.from_str("0.0.1"),  # type:ignore
#             plugin_link="http://localhost:5000/plugins/grafana",
#             download_link="http://localhost:5000/plugins/grafana/download",
#         ),
#         SimplePlugin(
#             name="nodecheck",
#             description="nodecheck description",
#             thumbnail="https://miro.medium.com/v2/resize:fit:800/1%2AzC_0Pkr4iFEbwbHhcG-dHw.png",
#             version=PluginVersion.from_str("0.0.1"),  # type:ignore
#             plugin_link="http://localhost:5000/plugins/nodecheck",
#             download_link="http://localhost:5000/plugins/nodecheck/download",
#         ),
#         SimplePlugin(
#             name="reportgen",
#             description="reporgen description",
#             thumbnail="https://miro.medium.com/v2/resize:fit:800/1%2AzC_0Pkr4iFEbwbHhcG-dHw.png",
#             version=PluginVersion.from_str("0.0.1"),  # type:ignore
#             plugin_link="http://localhost:5000/plugins/reportgen",
#             download_link="http://localhost:5000/plugins/reportgen/download",
#         ),
#     ]

#     return plugins
