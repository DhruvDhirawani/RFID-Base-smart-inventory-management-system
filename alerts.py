"""
Alert system that checks for low stock and near-expiry items.
Should be called after every checkin and checkout operation.
"""

from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import List
import models
import schemas
import crud


def check_alerts(db: Session) -> List[models.Notification]:
    """
    Main alert function that checks for:
    1. Low stock (total quantity of item falls below threshold)
    2. Near expiry (any lot expires within 15 days)
    
    Returns list of newly created notifications.
    """
    notifications_created = []
    
    # Check for low stock alerts
    low_stock_alerts = _check_low_stock(db)
    notifications_created.extend(low_stock_alerts)
    
    # Check for near-expiry alerts
    expiry_alerts = _check_near_expiry(db)
    notifications_created.extend(expiry_alerts)
    
    return notifications_created


def _check_low_stock(db: Session) -> List[models.Notification]:
    """Check if any item's total stock is below threshold"""
    notifications = []
    items = crud.get_all_items(db)
    
    for item in items:
        # Get total quantity in stock for this item
        active_checkins = db.query(models.Checkin).filter(
            models.Checkin.item_id == item.id,
            models.Checkin.is_checked_out == False
        ).all()
        
        total_quantity = sum(checkin.quantity for checkin in active_checkins)
        
        # Check if below threshold
        if total_quantity < item.low_stock_threshold:
            # Check if we already have a recent alert for this
            existing_alert = db.query(models.Notification).filter(
                models.Notification.type == "low_stock",
                models.Notification.message.like(f"%{item.name}%"),
                models.Notification.is_read == False,
                models.Notification.created_at >= datetime.utcnow() - timedelta(hours=1)
            ).first()
            
            if not existing_alert:
                # Create new alert
                notification = schemas.NotificationCreate(
                    type="low_stock",
                    message=f"Low stock alert: {item.name} has only {total_quantity} units (threshold: {item.low_stock_threshold})"
                )
                db_notification = crud.create_notification(db, notification)
                notifications.append(db_notification)
                
                # Create Reorder Request automatically
                reorder_qty = max(item.low_stock_threshold * 2, 10) # Simple reorder logic
                reorder_req = schemas.ReorderRequestCreate(item_id=item.id, quantity_requested=reorder_qty)
                crud.create_reorder_request(db, reorder_req)
                
                # Log audit trail
                crud.create_audit_log(db, "ALERT_GENERATED", f"Low stock alert for {item.name}. Auto-reorder requested.")
    
    return notifications


def _check_near_expiry(db: Session) -> List[models.Notification]:
    """Check if any lot expires within 15 days"""
    notifications = []
    today = date.today()
    expiry_threshold = today + timedelta(days=15)
    
    # Get all active checkins near expiry
    near_expiry_checkins = db.query(models.Checkin).filter(
        models.Checkin.is_checked_out == False,
        models.Checkin.expiry_date <= expiry_threshold,
        models.Checkin.expiry_date >= today
    ).all()
    
    for checkin in near_expiry_checkins:
        days_until_expiry = (checkin.expiry_date - today).days
        
        # Check if we already have a recent alert for this checkin
        existing_alert = db.query(models.Notification).filter(
            models.Notification.type == "near_expiry",
            models.Notification.message.like(f"%{checkin.item.name}%RFID: {checkin.rfid_tag}%"),
            models.Notification.is_read == False,
            models.Notification.created_at >= datetime.utcnow() - timedelta(hours=1)
        ).first()
        
        if not existing_alert:
            # Create new alert
            if days_until_expiry == 0:
                message = f"URGENT: {checkin.item.name} (RFID: {checkin.rfid_tag}) expires TODAY!"
            else:
                message = f"Near expiry: {checkin.item.name} (RFID: {checkin.rfid_tag}) expires in {days_until_expiry} days"
            
            notification = schemas.NotificationCreate(
                type="near_expiry",
                message=message
            )
            db_notification = crud.create_notification(db, notification)
            notifications.append(db_notification)
            
            # Log audit trail
            crud.create_audit_log(db, "ALERT_GENERATED", f"Expiry alert for {checkin.item.name} (RFID: {checkin.rfid_tag}).")
    
    return notifications


def _check_expired(db: Session) -> List[models.Notification]:
    """Check for already expired items (bonus feature)"""
    notifications = []
    today = date.today()
    
    # Get all active checkins that are already expired
    expired_checkins = db.query(models.Checkin).filter(
        models.Checkin.is_checked_out == False,
        models.Checkin.expiry_date < today
    ).all()
    
    for checkin in expired_checkins:
        # Check if we already have a recent alert
        existing_alert = db.query(models.Notification).filter(
            models.Notification.type == "expired",
            models.Notification.message.like(f"%{checkin.rfid_tag}%"),
            models.Notification.created_at >= datetime.utcnow() - timedelta(hours=24)
        ).first()
        
        if not existing_alert:
            days_expired = (today - checkin.expiry_date).days
            notification = schemas.NotificationCreate(
                type="expired",
                message=f"EXPIRED: {checkin.item.name} (RFID: {checkin.rfid_tag}) expired {days_expired} days ago!"
            )
            db_notification = crud.create_notification(db, notification)
            notifications.append(db_notification)
    
    return notifications
