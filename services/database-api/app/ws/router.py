from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from .manager import manager
from .poller import get_db_snapshot

router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    await manager.connect(websocket, channel="stream")
    # Gửi ngay snapshot dữ liệu mới nhất khi client vừa kết nối
    snapshot = get_db_snapshot()
    await websocket.send_json({
        "type": "snapshot",
        "channel": "stream",
        "data": snapshot,
        "server_time": datetime.utcnow().isoformat()
    })

    try:
        while True:
            # Lắng nghe message/ping từ client (nếu client gửi ping)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "server_time": datetime.utcnow().isoformat()
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel="stream")
    except Exception:
        manager.disconnect(websocket, channel="stream")


@router.websocket("/ws/{channel}")
async def websocket_channel(websocket: WebSocket, channel: str):
    await manager.connect(websocket, channel=channel)
    snapshot = get_db_snapshot()
    await websocket.send_json({
        "type": "snapshot",
        "channel": channel,
        "data": snapshot,
        "server_time": datetime.utcnow().isoformat()
    })

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "channel": channel,
                    "server_time": datetime.utcnow().isoformat()
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel=channel)
    except Exception:
        manager.disconnect(websocket, channel=channel)
