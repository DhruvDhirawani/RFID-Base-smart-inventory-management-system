import uuid
from datetime import datetime, timedelta, date
from database import SessionLocal
import models
import alerts

def add_stock():
    db = SessionLocal()
    items = db.query(models.Item).all()
    if not items:
        print("No items found.")
        return
        
    current_date = datetime.utcnow()
    today = date.today()
    
    # We will create exactly 12 active checkins.
    # First 4 will be low stock (quantity < threshold)
    # Next 4 will be near expiry (expiry_date within 3 days)
    # Last 4 will be normal.
    
    for i in range(12):
        item = items[i % len(items)]
        
        # Base values
        # Approximate purchase price based on existing records if possible, or just default to 100
        purchase_price = 100.0
        quantity = item.low_stock_threshold + 20
        expiry_date = today + timedelta(days=item.default_expiry_days)
        
        if i < 4:
            # Low stock
            quantity = max(1, item.low_stock_threshold - 2)
        elif i < 8:
            # Near expiry
            expiry_date = today + timedelta(days=2)
            
        checkin = models.Checkin(
            rfid_tag=f"RFID-ACT-{uuid.uuid4().hex[:6].upper()}",
            item_id=item.id,
            quantity=quantity,
            purchase_price=purchase_price,
            expiry_date=expiry_date,
            checked_in_at=current_date,
            is_checked_out=False
        )
        db.add(checkin)
    
    db.commit()
    
    # Trigger alerts so they appear in notifications immediately
    alerts_generated = alerts.check_alerts(db)
    print(f"Generated {len(alerts_generated)} alerts.")
    
    db.close()
    print("Added 12 active stock items.")

if __name__ == "__main__":
    add_stock()
