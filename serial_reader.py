"""
RFID Reader Module - Reads RFID tags from Arduino RC522 via USB serial port.
Broadcasts scan events to the frontend via WebSocket.

Key behaviour:
  - Tries to connect at startup; if the port is busy or absent, retries every
    RECONNECT_INTERVAL_S seconds automatically — no server restart needed.
  - Once connected, reads lines from the serial buffer in a tight async loop.
  - If the connection drops (Arduino unplugged, etc.) it reconnects automatically.
"""

import asyncio
import serial
import logging
from typing import Callable, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

RECONNECT_INTERVAL_S = 3   # seconds between reconnect attempts


class RFIDReader:
    """
    Async RFID reader with automatic reconnect.
    Usage:
        reader = RFIDReader(port="COM12")
        reader.set_callback(my_async_fn)
        asyncio.create_task(reader.start_reading())
    """

    def __init__(self, port: str = "COM12", baudrate: int = 9600):
        self.port = port
        self.baudrate = baudrate
        self.serial_connection: Optional[serial.Serial] = None
        self.is_running = False
        self.is_connected = False          # ← exposed so /rfid/status can read it
        self.callback: Optional[Callable] = None

    # ── public API ────────────────────────────────────────────────────────────

    def set_callback(self, callback: Callable) -> None:
        """Set async callback called with the RFID tag string on each scan."""
        self.callback = callback

    def stop(self) -> None:
        """Stop the reading loop and close the serial port."""
        self.is_running = False
        self._close()

    # ── internal ──────────────────────────────────────────────────────────────

    def _close(self) -> None:
        """Close the serial port if open."""
        if self.serial_connection and self.serial_connection.is_open:
            try:
                self.serial_connection.close()
            except Exception:
                pass
        self.serial_connection = None
        self.is_connected = False

    def _try_connect(self) -> bool:
        """
        Attempt a single connection to the serial port.
        Returns True on success, False on failure.
        """
        self._close()
        try:
            self.serial_connection = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=1,
            )
            self.is_connected = True
            logger.info(f"[RFID] Connected to {self.port} at {self.baudrate} baud")
            return True
        except serial.SerialException as e:
            logger.warning(f"[RFID] Cannot open {self.port}: {e}")
            return False
        except Exception as e:
            logger.warning(f"[RFID] Unexpected error connecting to {self.port}: {e}")
            return False

    async def start_reading(self) -> None:
        """
        Main reading loop.  Runs forever:
          1. Try to connect (retry every RECONNECT_INTERVAL_S on failure).
          2. Once connected, read lines and fire the callback.
          3. If the port dies, go back to step 1.
        """
        self.is_running = True
        logger.info(f"[RFID] Starting reader loop for {self.port}")

        while self.is_running:

            # ── phase 1: connect ──────────────────────────────────────────
            if not self._try_connect():
                logger.info(
                    f"[RFID] Retrying {self.port} in {RECONNECT_INTERVAL_S}s "
                    f"(make sure no other app has the port open)"
                )
                await asyncio.sleep(RECONNECT_INTERVAL_S)
                continue

            # ── phase 2: read loop ────────────────────────────────────────
            logger.info(f"[RFID] Reader active — waiting for tags on {self.port}")
            try:
                while self.is_running:
                    if not self.serial_connection or not self.serial_connection.is_open:
                        break

                    if self.serial_connection.in_waiting:
                        try:
                            raw = self.serial_connection.readline()
                            tag = raw.decode("utf-8", errors="ignore").strip()
                            # Filter out empty strings, startup info (spaces), or short noise
                            if tag and " " not in tag and len(tag) >= 4 and tag.isalnum():
                                logger.info(f"[RFID] Tag scanned: {tag}")
                                if self.callback:
                                    try:
                                        await self.callback(tag)
                                    except Exception as cb_err:
                                        logger.error(f"[RFID] Callback error: {cb_err}")
                        except serial.SerialException as read_err:
                            logger.error(f"[RFID] Read error: {read_err}")
                            break   # drop to reconnect phase
                        except Exception as e:
                            logger.error(f"[RFID] Unexpected read error: {e}")

                    # yield control — keeps asyncio event loop responsive
                    await asyncio.sleep(0.05)

            except Exception as outer_err:
                logger.error(f"[RFID] Outer loop error: {outer_err}")

            # ── phase 3: connection lost → try again ──────────────────────
            if self.is_running:
                self.is_connected = False
                logger.warning(
                    f"[RFID] Lost connection to {self.port}. "
                    f"Reconnecting in {RECONNECT_INTERVAL_S}s…"
                )
                self._close()
                await asyncio.sleep(RECONNECT_INTERVAL_S)

        self._close()
        logger.info("[RFID] Reader stopped.")

    def flush_buffer(self) -> None:
        """Clear any pending bytes in the serial buffer."""
        if self.serial_connection and self.serial_connection.is_open:
            self.serial_connection.reset_input_buffer()
            self.serial_connection.reset_output_buffer()
            logger.debug("[RFID] Buffer flushed")


# ── global singleton ──────────────────────────────────────────────────────────

_rfid_reader: Optional[RFIDReader] = None


def initialize_rfid_reader(port: str = "COM12", baudrate: int = 9600) -> RFIDReader:
    """Create (or replace) the global RFID reader instance."""
    global _rfid_reader
    _rfid_reader = RFIDReader(port=port, baudrate=baudrate)
    return _rfid_reader


def get_rfid_reader() -> Optional[RFIDReader]:
    """Return the global RFID reader instance (may be None if not initialised)."""
    return _rfid_reader
