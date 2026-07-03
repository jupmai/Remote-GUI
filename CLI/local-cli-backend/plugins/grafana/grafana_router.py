# Grafana Plugin - Simple URL redirect plugin
# This plugin provides access to Grafana dashboards

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import os

# Create the API router
api_router = APIRouter(prefix="/grafana", tags=["Grafana"])

# Optional Grafana URL. Fresh deployments do not provide a default dashboard.
GRAFANA_URL = os.getenv("GRAFANA_URL", "")

# Request/Response models
class GrafanaConfig(BaseModel):
    url: str

# API endpoints
@api_router.get("/")
async def grafana_info():
    """Get Grafana URL and information"""
    return {
        "name": "Grafana Plugin",
        "version": "1.0.0",
        "url": GRAFANA_URL,
        "description": "Access to Grafana dashboards"
    }

@api_router.get("/url")
async def get_grafana_url():
    """Get the Grafana URL"""
    return {
        "url": GRAFANA_URL
    }
