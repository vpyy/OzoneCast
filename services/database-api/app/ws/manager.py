import logging
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger("ozone.ws")

class ConnectionManager:
    def __init__(self):
        # channel -> set of active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str = "stream"):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        logger.info(f"[WS] Client connected on channel '{channel}' (total: {len(self.active_connections[channel])})")

    def disconnect(self, websocket: WebSocket, channel: str = "stream"):
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
            if not self.active_connections[channel]:
                del self.active_connections[channel]
        logger.info(f"[WS] Client disconnected from channel '{channel}'")

    async def broadcast(self, message: dict, channel: str = "stream"):
        """Gửi message tới toàn bộ client trên kênh, xử lý ngắt kết nối an toàn."""
        clients = list(self.active_connections.get(channel, []))
        for client in clients:
            try:
                await client.send_json(message)
            except Exception as e:
                logger.warning(f"[WS] Error broadcasting to client on channel '{channel}': {e}")
                self.disconnect(client, channel)

    async def broadcast_all(self, message: dict):
        """Gửi message tới tất cả client trên mọi kênh."""
        for ch in list(self.active_connections.keys()):
            await self.broadcast(message, channel=ch)

manager = ConnectionManager()
