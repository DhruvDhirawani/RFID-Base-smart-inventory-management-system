import random
import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import engine, SessionLocal
import models

# 1. Clear database
models.Base.metadata.drop_all(bind=engine)
models.Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()
    
    # 2. Create Items
    item_data = [
        {"name": "Laptop XPS 15", "low_stock_threshold": 5, "default_expiry_days": 1800, "holding_cost_per_day": 2.5, "base_price": 1200},
        {"name": "Wireless Mouse", "low_stock_threshold": 50, "default_expiry_days": 3600, "holding_cost_per_day": 0.1, "base_price": 25},
        {"name": "Mechanical Keyboard", "low_stock_threshold": 20, "default_expiry_days": 3600, "holding_cost_per_day": 0.3, "base_price": 80},
        {"name": "USB-C Hub", "low_stock_threshold": 30, "default_expiry_days": 3600, "holding_cost_per_day": 0.15, "base_price": 40},
        {"name": "27-inch Monitor", "low_stock_threshold": 10, "default_expiry_days": 2000, "holding_cost_per_day": 1.5, "base_price": 300},
        {"name": "Noise Cancelling Headphones", "low_stock_threshold": 15, "default_expiry_days": 1800, "holding_cost_per_day": 0.5, "base_price": 200},
        {"name": "Ergonomic Chair", "low_stock_threshold": 8, "default_expiry_days": 3600, "holding_cost_per_day": 1.0, "base_price": 250},
    ]

    items = []
    for data in item_data:
        item = models.Item(
            name=data["name"],
            low_stock_threshold=data["low_stock_threshold"],
            default_expiry_days=data["default_expiry_days"],
            holding_cost_per_day=data["holding_cost_per_day"]
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        items.append({"model": item, "base_price": data["base_price"]})

    # 3. Simulate 2 Years
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=2 * 365)
    
    current_date = start_date
    
    active_checkins = []
    
    print(f"Starting simulation from {start_date.date()} to {end_date.date()}")

    while current_date <= end_date:
        # Simulate Checkins
        if random.random() < 0.3: # 30% chance of restock on any given day
            num_restocks = random.randint(1, 3)
            for _ in range(num_restocks):
                item_info = random.choice(items)
                item = item_info["model"]
                base_price = item_info["base_price"]
                
                # Prices fluctuate a bit
                purchase_price = round(base_price * random.uniform(0.9, 1.1), 2)
                quantity = random.randint(5, 50)
                
                expiry_date = (current_date + timedelta(days=item.default_expiry_days)).date()
                
                checkin = models.Checkin(
                    rfid_tag=f"RFID-{uuid.uuid4().hex[:8].upper()}",
                    item_id=item.id,
                    quantity=quantity,
                    purchase_price=purchase_price,
                    expiry_date=expiry_date,
                    checked_in_at=current_date,
                    is_checked_out=False
                )
                db.add(checkin)
                db.commit()
                db.refresh(checkin)
                active_checkins.append(checkin)
                
                # Log
                log = models.AuditLog(
                    action="CHECKIN",
                    description=f"Checked in {quantity}x {item.name}",
                    timestamp=current_date
                )
                db.add(log)
                db.commit()

        # Simulate Checkouts
        if random.random() < 0.6: # 60% chance of a sale on any given day
            if active_checkins:
                num_sales = random.randint(1, 5)
                for _ in range(min(num_sales, len(active_checkins))):
                    if not active_checkins:
                        break
                    
                    checkin = active_checkins.pop(random.randint(0, len(active_checkins) - 1))
                    
                    days_held = (current_date - checkin.checked_in_at).days
                    days_held = max(0, days_held)
                    
                    # Selling price markup 20% to 50%
                    selling_price = round(checkin.purchase_price * random.uniform(1.2, 1.5), 2)
                    
                    holding_cost = checkin.item.holding_cost_per_day * days_held * checkin.quantity
                    profit_loss = (selling_price - checkin.purchase_price) * checkin.quantity - holding_cost
                    
                    checkin.is_checked_out = True
                    
                    checkout = models.Checkout(
                        checkin_id=checkin.id,
                        selling_price=selling_price,
                        checked_out_at=current_date,
                        days_held=days_held,
                        profit_loss=round(profit_loss, 2)
                    )
                    db.add(checkout)
                    
                    # Log
                    log = models.AuditLog(
                        action="CHECKOUT",
                        description=f"Checked out {checkin.quantity}x {checkin.item.name} (Tag: {checkin.rfid_tag})",
                        timestamp=current_date
                    )
                    db.add(log)
                    db.commit()

        current_date += timedelta(days=1)
        
    db.close()
    print("Seeding completed!")

if __name__ == "__main__":
    seed()
