from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
from datetime import datetime, date, timedelta
from typing import List, Optional
import models
import schemas


# ========== ITEM OPERATIONS ==========
def get_all_items(db: Session) -> List[models.Item]:
    """Get all items from database"""
    return db.query(models.Item).all()


def get_item_by_id(db: Session, item_id: int) -> Optional[models.Item]:
    """Get item by ID"""
    return db.query(models.Item).filter(models.Item.id == item_id).first()


def create_item(db: Session, item: schemas.ItemCreate) -> models.Item:
    """Create a new item"""
    db_item = models.Item(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


# ========== CHECKIN OPERATIONS ==========
def create_checkin(db: Session, checkin: schemas.CheckinCreate) -> models.Checkin:
    """Create a new checkin record"""
    db_checkin = models.Checkin(**checkin.dict())
    db.add(db_checkin)
    db.commit()
    db.refresh(db_checkin)
    return db_checkin


def get_checkin_by_rfid_unchecked(db: Session, rfid_tag: str) -> Optional[models.Checkin]:
    """Get an unchecked-out checkin by RFID tag (for checkout process)"""
    return db.query(models.Checkin).filter(
        and_(
            models.Checkin.rfid_tag == rfid_tag,
            models.Checkin.is_checked_out == False
        )
    ).first()


def get_checkin_history(db: Session, page: int = 1, limit: int = 10) -> List[models.Checkin]:
    """Get paginated checkin history (most recent first)"""
    skip = (page - 1) * limit
    return db.query(models.Checkin).order_by(desc(models.Checkin.checked_in_at)).offset(skip).limit(limit).all()


def get_checkin_count(db: Session) -> int:
    """Get total checkin count"""
    return db.query(models.Checkin).count()


def mark_checkin_as_checked_out(db: Session, checkin_id: int) -> models.Checkin:
    """Mark a checkin as checked out"""
    db_checkin = db.query(models.Checkin).filter(models.Checkin.id == checkin_id).first()
    if db_checkin:
        db_checkin.is_checked_out = True
        db.commit()
        db.refresh(db_checkin)
    return db_checkin


def get_current_stock(db: Session) -> List[models.Checkin]:
    """Get all active (not checked out) checkins"""
    return db.query(models.Checkin).filter(
        models.Checkin.is_checked_out == False
    ).order_by(desc(models.Checkin.checked_in_at)).all()


# ========== CHECKOUT OPERATIONS ==========
def create_checkout(db: Session, checkout: schemas.CheckoutCreate) -> models.Checkout:
    """Create a new checkout record"""
    db_checkout = models.Checkout(**checkout.dict())
    db.add(db_checkout)
    db.commit()
    db.refresh(db_checkout)
    return db_checkout


def get_checkout_history(db: Session, page: int = 1, limit: int = 10) -> List[models.Checkout]:
    """Get paginated checkout history (most recent first)"""
    skip = (page - 1) * limit
    return db.query(models.Checkout).order_by(desc(models.Checkout.checked_out_at)).offset(skip).limit(limit).all()


def get_checkout_count(db: Session) -> int:
    """Get total checkout count"""
    return db.query(models.Checkout).count()


# ========== NOTIFICATION OPERATIONS ==========
def create_notification(db: Session, notification: schemas.NotificationCreate) -> models.Notification:
    """Create a new notification"""
    db_notification = models.Notification(**notification.dict())
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    return db_notification


def get_all_notifications(db: Session, limit: int = 50) -> List[models.Notification]:
    """Get recent notifications (most recent first)"""
    return db.query(models.Notification).order_by(desc(models.Notification.created_at)).limit(limit).all()


def mark_notification_as_read(db: Session, notification_id: int) -> models.Notification:
    """Mark notification as read"""
    db_notification = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if db_notification:
        db_notification.is_read = True
        db.commit()
        db.refresh(db_notification)
    return db_notification


# ========== AGGREGATE OPERATIONS ==========
def get_total_working_capital(db: Session) -> float:
    """Calculate total working capital = sum of (quantity * purchase_price) for all active stock"""
    active_checkins = get_current_stock(db)
    total = 0.0
    for checkin in active_checkins:
        total += checkin.quantity * checkin.purchase_price
    return total


def get_total_profit_loss(db: Session) -> float:
    """Calculate total profit/loss from all checkouts"""
    total = db.query(models.Checkout).all()
    return sum(checkout.profit_loss for checkout in total)


def get_profit_loss_records(db: Session) -> List[dict]:
    """Get detailed profit/loss records for analysis"""
    checkouts = db.query(models.Checkout).order_by(desc(models.Checkout.checked_out_at)).all()
    records = []
    
    for checkout in checkouts:
        checkin = checkout.checkin
        item = checkin.item
        holding_cost = checkin.item.holding_cost_per_day * checkout.days_held * checkin.quantity
        
        records.append({
            "checkin_id": checkin.id,
            "item_name": item.name,
            "rfid_tag": checkin.rfid_tag,
            "purchase_price": checkin.purchase_price,
            "quantity": checkin.quantity,
            "selling_price": checkout.selling_price,
            "days_held": checkout.days_held,
            "holding_cost": holding_cost,
            "profit_loss": checkout.profit_loss,
            "checked_in_at": checkin.checked_in_at,
            "checked_out_at": checkout.checked_out_at,
        })
    
    return records


def get_current_stock_items(db: Session) -> List[dict]:
    """Get detailed current stock items"""
    stock = get_current_stock(db)
    items = []
    
    for checkin in stock:
        days_until_expiry = (checkin.expiry_date - date.today()).days
        
        items.append({
            "checkin_id": checkin.id,
            "item_name": checkin.item.name,
            "rfid_tag": checkin.rfid_tag,
            "quantity": checkin.quantity,
            "purchase_price": checkin.purchase_price,
            "expiry_date": checkin.expiry_date,
            "checked_in_at": checkin.checked_in_at,
            "days_until_expiry": days_until_expiry,
            "note": checkin.note,
        })
    
    return items


# ========== AUDIT LOG OPERATIONS ==========
def create_audit_log(db: Session, action: str, description: str) -> models.AuditLog:
    """Create a new audit log entry"""
    db_log = models.AuditLog(action=action, description=description)
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


def get_audit_logs(db: Session, page: int = 1, limit: int = 10) -> tuple[List[models.AuditLog], int]:
    """Get paginated audit logs and total count"""
    skip = (page - 1) * limit
    total = db.query(models.AuditLog).count()
    items = db.query(models.AuditLog).order_by(desc(models.AuditLog.timestamp)).offset(skip).limit(limit).all()
    return items, total


# ========== REORDER REQUEST OPERATIONS ==========
def create_reorder_request(db: Session, request: schemas.ReorderRequestCreate) -> models.ReorderRequest:
    """Create a new auto reorder request"""
    db_req = models.ReorderRequest(**request.dict())
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req


def get_reorder_requests(db: Session) -> List[models.ReorderRequest]:
    """Get all reorder requests"""
    return db.query(models.ReorderRequest).order_by(desc(models.ReorderRequest.generated_at)).all()


def fulfill_reorder_request(db: Session, request_id: int) -> Optional[models.ReorderRequest]:
    """Mark a reorder request as fulfilled"""
    db_req = db.query(models.ReorderRequest).filter(models.ReorderRequest.id == request_id).first()
    if db_req:
        db_req.status = "FULFILLED"
        db.commit()
        db.refresh(db_req)
    return db_req


# ========== ANALYTICS OPERATIONS ==========
def get_inventory_turnover(db: Session) -> List[schemas.TurnoverResponse]:
    """Calculate inventory turnover rate per item"""
    items = get_all_items(db)
    results = []
    
    for item in items:
        # Total sold (quantity of checked out checkins)
        checkouts = db.query(models.Checkout).join(models.Checkin).filter(models.Checkin.item_id == item.id).all()
        total_sold = sum(checkout.checkin.quantity for checkout in checkouts)
        
        # Current inventory
        current_checkins = db.query(models.Checkin).filter(
            models.Checkin.item_id == item.id,
            models.Checkin.is_checked_out == False
        ).all()
        current_inventory = sum(checkin.quantity for checkin in current_checkins)
        
        # Turnover rate = Cost of Goods Sold / Average Inventory
        # For simplicity, using (Total Units Sold) / (Current Inventory) if > 0
        avg_inventory = current_inventory if current_inventory > 0 else 1
        turnover_rate = total_sold / avg_inventory if total_sold > 0 else 0
        
        results.append(schemas.TurnoverResponse(
            item_name=item.name,
            turnover_rate=round(turnover_rate, 2),
            total_sold=total_sold,
            avg_inventory=current_inventory
        ))
        
    return results


def get_dead_stock(db: Session) -> List[schemas.DeadStockResponse]:
    """Items/lots that have been in stock for more than 30 days without checkout"""
    threshold_date = datetime.utcnow() - timedelta(days=30)
    
    dead_stock_items = db.query(models.Checkin).filter(
        models.Checkin.is_checked_out == False,
        models.Checkin.checked_in_at <= threshold_date
    ).all()
    
    results = []
    for checkin in dead_stock_items:
        days_in_stock = (datetime.utcnow() - checkin.checked_in_at).days
        results.append(schemas.DeadStockResponse(
            item_name=checkin.item.name,
            rfid_tag=checkin.rfid_tag,
            days_in_stock=days_in_stock,
            quantity=checkin.quantity
        ))
        
    return results


def get_demand_forecast(db: Session) -> List[schemas.DemandForecastResponse]:
    """Predicted restock date per item based on average daily checkout rate"""
    items = get_all_items(db)
    results = []
    
    # Calculate across last 30 days
    start_date = datetime.utcnow() - timedelta(days=30)
    
    for item in items:
        # Current stock
        current_checkins = db.query(models.Checkin).filter(
            models.Checkin.item_id == item.id,
            models.Checkin.is_checked_out == False
        ).all()
        current_stock = sum(checkin.quantity for checkin in current_checkins)
        
        # Units checked out in last 30 days
        recent_checkouts = db.query(models.Checkout).join(models.Checkin).filter(
            models.Checkin.item_id == item.id,
            models.Checkout.checked_out_at >= start_date
        ).all()
        units_sold_30d = sum(checkout.checkin.quantity for checkout in recent_checkouts)
        
        avg_daily_checkout = units_sold_30d / 30.0
        
        predicted_date = None
        if avg_daily_checkout > 0:
            days_until_empty = current_stock / avg_daily_checkout
            predicted_date = (datetime.utcnow() + timedelta(days=days_until_empty)).date()
            
        results.append(schemas.DemandForecastResponse(
            item_name=item.name,
            current_stock=current_stock,
            avg_daily_checkout=round(avg_daily_checkout, 2),
            predicted_restock_date=predicted_date
        ))
        
    return results


def get_abc_classification(db: Session) -> List[schemas.AbcClassificationResponse]:
    """Classify items as A, B, or C based on total profit contribution"""
    items = get_all_items(db)
    item_profits = []
    total_system_profit = 0
    
    for item in items:
        checkouts = db.query(models.Checkout).join(models.Checkin).filter(models.Checkin.item_id == item.id).all()
        item_profit = sum(checkout.profit_loss for checkout in checkouts)
        if item_profit > 0:
            total_system_profit += item_profit
            item_profits.append({"name": item.name, "profit": item_profit})
        else:
            item_profits.append({"name": item.name, "profit": 0})
            
    # Sort by profit descending
    item_profits.sort(key=lambda x: x["profit"], reverse=True)
    
    results = []
    cumulative_percentage = 0
    
    for ip in item_profits:
        profit_percentage = (ip["profit"] / total_system_profit * 100) if total_system_profit > 0 else 0
        cumulative_percentage += profit_percentage
        
        if cumulative_percentage <= 70:
            classification = "A"
        elif cumulative_percentage <= 90:
            classification = "B"
        else:
            classification = "C"
            
        results.append(schemas.AbcClassificationResponse(
            item_name=ip["name"],
            total_profit=round(ip["profit"], 2),
            profit_percentage=round(profit_percentage, 2),
            classification=classification
        ))
        
    return results


def get_daily_flow(db: Session) -> List[schemas.DailyFlowResponse]:
    """Checkins vs checkouts count per day for last 30 days"""
    start_date = datetime.utcnow() - timedelta(days=30)
    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Generate last 30 days dates
    dates = [(start_date + timedelta(days=i)).date() for i in range(31)]
    results = {d: {"checkins": 0, "checkouts": 0} for d in dates}
    
    # Get checkins
    checkins = db.query(models.Checkin).filter(models.Checkin.checked_in_at >= start_date).all()
    for c in checkins:
        d = c.checked_in_at.date()
        if d in results:
            results[d]["checkins"] += c.quantity
            
    # Get checkouts
    checkouts = db.query(models.Checkout).join(models.Checkin).filter(models.Checkout.checked_out_at >= start_date).all()
    for c in checkouts:
        d = c.checked_out_at.date()
        if d in results:
            results[d]["checkouts"] += c.checkin.quantity
            
    # Format response
    response = []
    for d, counts in results.items():
        response.append(schemas.DailyFlowResponse(
            date=d,
            checkins=counts["checkins"],
            checkouts=counts["checkouts"]
        ))
        
    return sorted(response, key=lambda x: x.date)


def get_stock_trend(db: Session) -> List[schemas.StockTrendResponse]:
    """Stock level over time per item for last 30 days"""
    # This is complex to compute perfectly from current DB schema.
    # Approximation: Current stock - checkins (working backward) + checkouts (working backward)
    # Since sqlite doesn't easily support window functions natively with ORM in a simple way without raw SQL
    # We will compute state day by day
    
    items = get_all_items(db)
    start_date = datetime.utcnow() - timedelta(days=30)
    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    dates = [(start_date + timedelta(days=i)).date() for i in range(31)]
    
    results = []
    
    for item in items:
        # Get all transactions for this item
        checkins = db.query(models.Checkin).filter(models.Checkin.item_id == item.id).all()
        checkouts = db.query(models.Checkout).join(models.Checkin).filter(models.Checkin.item_id == item.id).all()
        
        # Calculate stock on each day
        for d in dates:
            # Stock on day d is sum of checkins before or on d, minus checkouts before or on d
            stock = 0
            for c in checkins:
                if c.checked_in_at.date() <= d:
                    stock += c.quantity
            for c in checkouts:
                if c.checked_out_at.date() <= d:
                    stock -= c.checkin.quantity
                    
            results.append(schemas.StockTrendResponse(
                date=d,
                item_name=item.name,
                quantity=max(0, stock) # Prevent negative stock in edge cases
            ))
            
    return sorted(results, key=lambda x: x.date)

