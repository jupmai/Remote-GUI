from fastapi import APIRouter, Query
from helpers import make_request, monitor_network, parse_response
from classes import Connection
from pydantic import BaseModel
import os
import subprocess
import json

api_router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


def run_anylog_command(cmd: str):
    """Run AnyLog CLI command"""
    result = subprocess.run(
        ["anylog", cmd],
        capture_output=True,
        text=True
    )
    return result.stdout

@api_router.get("/grafana")
def monitor_grafana(conn: str = Query(...)):
    monitored_nodes = monitor_network(conn)

    if isinstance(monitored_nodes, str):
        monitored_nodes = json.loads(monitored_nodes)

    return {"data": monitored_nodes}

@api_router.get("/grafana")
def monitor_grafana(conn: str = Query(...)):
    monitored_nodes = monitor_network(conn)

    if isinstance(monitored_nodes, str):
        monitored_nodes = json.loads(monitored_nodes)

    return {"data": monitored_nodes}