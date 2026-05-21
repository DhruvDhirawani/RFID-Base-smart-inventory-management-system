import asyncio
import websockets

async def test_ws():
    try:
        async with websockets.connect('ws://localhost:8000/ws') as ws:
            print("Successfully connected to WebSocket!")
            await ws.send("hello")
    except Exception as e:
        print(f"WebSocket connection failed: {e}")

asyncio.run(test_ws())
