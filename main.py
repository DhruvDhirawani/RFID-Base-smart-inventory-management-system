"""
FastAPI Backend for RFID Inventory Management System
Runs on localhost:8000
"""

import asyncio
import logging
from datetime import datetime, date, timedelta
from typing import List, Set
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import schemas
import crud
import alerts
from database import engine, SessionLocal, Base
from serial_reader import initialize_rfid_reader, get_rfid_reader

# ========== Configuration ==========
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Hardcoded credentials (as per requirements)
VALID_USERNAME = "admin"
VALID_PASSWORD = "password"

# Global System Tracking Variables
SYSTEM_START_TIME = None
SCAN_STATS = {
    "total": 0,
    "success": 0,
    "failed": 0
}

# WebSocket client manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
    
    async def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending to client: {e}")


manager = ConnectionManager()

# ========== FastAPI App Setup ==========
app = FastAPI(title="StockWatch", version="1.0.0")

# CORS middleware - allow frontend on localhost:5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ========== STARTUP / SHUTDOWN ==========
@app.on_event("startup")
async def startup_event():
    """Initialize database, seed data, and start RFID reader"""
    global SYSTEM_START_TIME
    SYSTEM_START_TIME = datetime.utcnow()
    logger.info("Starting up RFID Inventory System...")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")
    
    # Seed demo items if they don't exist
    db = SessionLocal()
    try:
        existing_items = crud.get_all_items(db)
        if len(existing_items) == 0:
            seed_items = [
                schemas.ItemCreate(
                    name="Rice 5kg",
                    default_expiry_days=365,
                    low_stock_threshold=10,
                    holding_cost_per_day=0.5
                ),
                schemas.ItemCreate(
                    name="Cooking Oil 1L",
                    default_expiry_days=180,
                    low_stock_threshold=8,
                    holding_cost_per_day=0.3
                ),
                schemas.ItemCreate(
                    name="Sugar 1kg",
                    default_expiry_days=730,
                    low_stock_threshold=15,
                    holding_cost_per_day=0.2
                ),
                schemas.ItemCreate(
                    name="Wheat Flour 2kg",
                    default_expiry_days=270,
                    low_stock_threshold=12,
                    holding_cost_per_day=0.4
                ),
            ]
            
            for item in seed_items:
                crud.create_item(db, item)
            logger.info("Seeded 4 demo items")
    finally:
        db.close()
    
    # Initialize RFID reader (COM3 by default, can be changed)
    try:
        rfid_reader = initialize_rfid_reader(port="COM12", baudrate=9600)
        rfid_reader.set_callback(rfid_callback)
        
        # Start RFID reading task
        asyncio.create_task(rfid_reader.start_reading())
        logger.info("RFID reader initialized on COM12")
    except Exception as e:
        logger.warning(f"Could not initialize RFID reader: {e}")
    
    logger.info("Startup complete!")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    logger.info("Shutting down...")
    rfid_reader = get_rfid_reader()
    if rfid_reader:
        rfid_reader.disconnect()
    logger.info("Shutdown complete!")


# ========== RFID CALLBACK ==========
async def rfid_callback(rfid_tag: str):
    """Called when RFID tag is scanned"""
    global SCAN_STATS
    SCAN_STATS["total"] += 1
    
    if rfid_tag and len(rfid_tag) > 0:
        SCAN_STATS["success"] += 1
    else:
        SCAN_STATS["failed"] += 1

    message = {
        "type": "rfid_scan",
        "rfid_tag": rfid_tag,
        "timestamp": datetime.utcnow().isoformat()
    }
    await manager.broadcast(message)
    logger.info(f"Broadcasted RFID scan: {rfid_tag}")


# ========== WEBSOCKET ENDPOINT ==========
@app.websocket("/ws/rfid")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time RFID scans"""
    await manager.connect(websocket)
    logger.info("WebSocket client connected")
    
    try:
        while True:
            # Keep connection alive, just wait for messages
            data = await websocket.receive_text()
            # Echo or ignore client messages if needed
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.disconnect(websocket)


# ========== AUTHENTICATION ==========
@app.post("/login")
async def login(credentials: schemas.LoginRequest, db: Session = Depends(get_db)) -> schemas.LoginResponse:
    """
    Simple login endpoint with hardcoded credentials.
    Returns success/failure message.
    """
    if credentials.username == VALID_USERNAME and credentials.password == VALID_PASSWORD:
        crud.create_audit_log(db, "LOGIN", f"User '{credentials.username}' logged in successfully.")
        return schemas.LoginResponse(
            success=True,
            message="Login successful"
        )
    else:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )


# ========== ITEM ENDPOINTS ==========
@app.get("/items", response_model=List[schemas.ItemResponse])
async def get_items(db: Session = Depends(get_db)):
    """Get all items"""
    return crud.get_all_items(db)


# ========== CHECKIN ENDPOINTS ==========
@app.post("/checkin", response_model=schemas.CheckinResponse)
async def create_checkin(
    checkin: schemas.CheckinCreate,
    db: Session = Depends(get_db)
):
    """Create a new checkin record"""
    # Verify item exists
    item = crud.get_item_by_id(db, checkin.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # ── Duplicate RFID guard ──────────────────────────────────────────────────
    # If this RFID tag already has an active lot in stock, block the checkin.
    # The tag must be checked out before it can be reused.
    existing = crud.get_checkin_by_rfid_unchecked(db, checkin.rfid_tag)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=(
                f"RFID tag '{checkin.rfid_tag}' is already in stock as "
                f"'{existing.item.name}' (Qty: {existing.quantity}, "
                f"checked in on {existing.checked_in_at.strftime('%d %b %Y')}). "
                f"Check it out first before reusing this tag."
            ),
        )
    # ─────────────────────────────────────────────────────────────────────────

    # Create checkin
    db_checkin = crud.create_checkin(db, checkin)
    
    # Check for alerts
    alerts.check_alerts(db)
    
    # Audit log
    crud.create_audit_log(db, "CHECKIN", f"Checked in {checkin.quantity} units of {item.name} (RFID: {checkin.rfid_tag}).")
    
    return db_checkin


@app.get("/checkins", response_model=List[schemas.CheckinDetailResponse])
async def get_checkins(
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db)
):
    """Get paginated checkin history"""
    return crud.get_checkin_history(db, page=page, limit=10)


@app.get("/checkins/count")
async def get_checkins_count(db: Session = Depends(get_db)):
    """Get total number of checkins"""
    return {"count": crud.get_checkin_count(db)}


@app.get("/checkin/{rfid_tag}", response_model=schemas.CheckinDetailResponse)
async def get_checkin_by_rfid(rfid_tag: str, db: Session = Depends(get_db)):
    """Get unchecked-out checkin by RFID tag (for checkout process)"""
    checkin = crud.get_checkin_by_rfid_unchecked(db, rfid_tag)
    if not checkin:
        raise HTTPException(status_code=404, detail="Unchecked-out item not found for this RFID tag")
    return checkin


# ========== CHECKOUT ENDPOINTS ==========
@app.post("/checkout", response_model=schemas.CheckoutResponse)
async def create_checkout(
    checkout_data: schemas.CheckoutCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new checkout record.
    Calculates days_held and profit_loss automatically.
    """
    # Get associated checkin
    checkin = db.query(models.Checkin).filter(
        models.Checkin.id == checkout_data.checkin_id
    ).first()
    
    if not checkin:
        raise HTTPException(status_code=404, detail="Checkin not found")
    
    if checkin.is_checked_out:
        raise HTTPException(status_code=400, detail="Item already checked out")
    
    # Calculate days held
    days_held = (datetime.utcnow().date() - checkin.checked_in_at.date()).days
    
    # Calculate profit/loss
    holding_cost = checkin.item.holding_cost_per_day * days_held * checkin.quantity
    total_selling = checkout_data.selling_price * checkin.quantity
    total_purchase = checkin.purchase_price * checkin.quantity
    profit_loss = total_selling - total_purchase - holding_cost
    
    # Create checkout with calculated fields
    checkout_create = schemas.CheckoutCreate(
        checkin_id=checkout_data.checkin_id,
        selling_price=checkout_data.selling_price
    )
    
    db_checkout = models.Checkout(
        **checkout_create.dict(),
        days_held=days_held,
        profit_loss=profit_loss
    )
    
    db.add(db_checkout)
    
    # Mark checkin as checked out
    checkin.is_checked_out = True
    db.commit()
    db.refresh(db_checkout)
    
    # Check for alerts
    alerts.check_alerts(db)
    
    # Audit log
    crud.create_audit_log(db, "CHECKOUT", f"Checked out {checkin.quantity} units of {checkin.item.name} (RFID: {checkin.rfid_tag}). Profit: ${profit_loss:.2f}")
    
    return db_checkout


@app.get("/checkouts", response_model=List[schemas.CheckoutDetailResponse])
async def get_checkouts(
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db)
):
    """Get paginated checkout history"""
    return crud.get_checkout_history(db, page=page, limit=10)


@app.get("/checkouts/count")
async def get_checkouts_count(db: Session = Depends(get_db)):
    """Get total number of checkouts"""
    return {"count": crud.get_checkout_count(db)}


# ========== STOCK ENDPOINTS ==========
@app.get("/current-stock")
async def get_current_stock(db: Session = Depends(get_db)):
    """Get current stock with all details"""
    stock_items = crud.get_current_stock_items(db)
    return {
        "items": stock_items,
        "total_items": len(stock_items),
        "total_quantity": sum(item["quantity"] for item in stock_items),
    }


@app.get("/working-capital")
async def get_working_capital(db: Session = Depends(get_db)):
    """Get total working capital invested in current stock"""
    total = crud.get_total_working_capital(db)
    return {"total_working_capital": total}


# ========== PROFIT/LOSS ENDPOINTS ==========
@app.get("/profit-loss")
async def get_profit_loss(db: Session = Depends(get_db)):
    """Get total profit/loss and detailed transaction history"""
    total_profit_loss = crud.get_total_profit_loss(db)
    records = crud.get_profit_loss_records(db)
    
    return {
        "total_profit_loss": total_profit_loss,
        "transaction_count": len(records),
        "transactions": records,
    }


# ========== NOTIFICATION ENDPOINTS ==========
@app.get("/notifications", response_model=List[schemas.NotificationResponse])
async def get_notifications(db: Session = Depends(get_db)):
    """Get recent notifications"""
    return crud.get_all_notifications(db, limit=50)


@app.patch("/notifications/{notification_id}")
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db)
):
    """Mark a notification as read"""
    notification = crud.mark_notification_as_read(db, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


# ========== HEALTH CHECK ==========
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ========== NEW SYSTEM ENDPOINTS ==========
@app.get("/system/uptime")
async def get_system_uptime():
    """Returns system uptime"""
    if not SYSTEM_START_TIME:
        return {"uptime": "Unknown", "hours": 0, "minutes": 0}
        
    diff = datetime.utcnow() - SYSTEM_START_TIME
    total_seconds = int(diff.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, _ = divmod(remainder, 60)
    
    return {
        "uptime": f"{hours} hours {minutes} minutes",
        "hours": hours,
        "minutes": minutes
    }


@app.get("/system/serial-status")
async def get_serial_status():
    """Returns RFID reader connection status"""
    reader = get_rfid_reader()
    if reader and reader.is_connected:
        return {"connected": True, "port": reader.port}
    return {"connected": False, "port": None}


@app.get("/system/scan-stats")
async def get_scan_stats():
    """Returns scan statistics"""
    return SCAN_STATS


# ========== AUDIT LOG ENDPOINTS ==========
@app.get("/audit-logs", response_model=schemas.AuditLogPaginatedResponse)
async def get_audit_logs(page: int = Query(1, ge=1), db: Session = Depends(get_db)):
    """Get paginated audit logs"""
    limit = 10
    items, total = crud.get_audit_logs(db, page=page, limit=limit)
    pages = (total + limit - 1) // limit
    return schemas.AuditLogPaginatedResponse(items=items, total=total, page=page, pages=pages)


# ========== REORDER REQUEST ENDPOINTS ==========
@app.get("/reorder-requests", response_model=List[schemas.ReorderRequestResponse])
async def get_reorder_requests(db: Session = Depends(get_db)):
    """Get all reorder requests"""
    return crud.get_reorder_requests(db)


@app.patch("/reorder-requests/{request_id}/fulfill", response_model=schemas.ReorderRequestResponse)
async def fulfill_reorder_request(request_id: int, db: Session = Depends(get_db)):
    """Mark a reorder request as fulfilled"""
    req = crud.fulfill_reorder_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Reorder request not found")
    crud.create_audit_log(db, "ACTION", f"Fulfilled reorder request #{request_id} for {req.quantity_requested} units.")
    return req


# ========== ANALYTICS ENDPOINTS ==========
@app.get("/analytics/turnover", response_model=List[schemas.TurnoverResponse])
async def get_analytics_turnover(db: Session = Depends(get_db)):
    return crud.get_inventory_turnover(db)

@app.get("/analytics/dead-stock", response_model=List[schemas.DeadStockResponse])
async def get_analytics_dead_stock(db: Session = Depends(get_db)):
    return crud.get_dead_stock(db)

@app.get("/analytics/demand-forecast", response_model=List[schemas.DemandForecastResponse])
async def get_analytics_demand_forecast(db: Session = Depends(get_db)):
    return crud.get_demand_forecast(db)

@app.get("/analytics/abc-classification", response_model=List[schemas.AbcClassificationResponse])
async def get_analytics_abc_classification(db: Session = Depends(get_db)):
    return crud.get_abc_classification(db)

@app.get("/analytics/daily-flow", response_model=List[schemas.DailyFlowResponse])
async def get_analytics_daily_flow(db: Session = Depends(get_db)):
    return crud.get_daily_flow(db)

@app.get("/analytics/stock-trend", response_model=List[schemas.StockTrendResponse])
async def get_analytics_stock_trend(db: Session = Depends(get_db)):
    return crud.get_stock_trend(db)



# ========== ROOT ==========
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "RFID Inventory Management System",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
