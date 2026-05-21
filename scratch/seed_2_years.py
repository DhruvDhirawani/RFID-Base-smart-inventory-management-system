import sys
import os
from datetime import datetime, date, timedelta
import random

# Add root dir to path so we can import from the main application
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine, Base
import models

# Ensure tables exist
Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── 1. WIPE EXISTING DATA ──────────────────────────────────────────────
print("Wiping existing checkins, checkouts, audit logs, and notifications...")
db.query(models.AuditLog).delete()
db.query(models.ReorderRequest).delete()
db.query(models.Checkout).delete()
db.query(models.Checkin).delete()
db.query(models.Notification).delete()
db.commit()

# ── 2. ENSURE SEED ITEMS ───────────────────────────────────────────────
seed_items = [
    dict(name="Rice 5kg",        default_expiry_days=365, low_stock_threshold=10, holding_cost_per_day=0.5),
    dict(name="Cooking Oil 1L",  default_expiry_days=180, low_stock_threshold=8,  holding_cost_per_day=0.3),
    dict(name="Sugar 1kg",       default_expiry_days=730, low_stock_threshold=15, holding_cost_per_day=0.2),
    dict(name="Wheat Flour 2kg", default_expiry_days=270, low_stock_threshold=12, holding_cost_per_day=0.4),
]

for si in seed_items:
    if not db.query(models.Item).filter(models.Item.name == si["name"]).first():
        db.add(models.Item(**si))
db.commit()

items = db.query(models.Item).all()

# ── 3. GENERATE 2 YEARS OF DATA ─────────────────────────────────────────
print("Generating 2 years of random checkins and checkouts...")

def random_date_past(max_days_ago=730):
    days_ago = random.randint(0, max_days_ago)
    return datetime.utcnow() - timedelta(days=days_ago)

TOTAL_CHECKINS = 120
checked_in = []

for i in range(TOTAL_CHECKINS):
    itm = random.choice(items)
    qty = random.randint(10, 50)
    
    # Base prices to randomize around
    base_price = 0
    if itm.name == "Rice 5kg": base_price = 250
    elif itm.name == "Cooking Oil 1L": base_price = 120
    elif itm.name == "Sugar 1kg": base_price = 55
    elif itm.name == "Wheat Flour 2kg": base_price = 85
    
    buy_price = round(base_price + random.uniform(-10, 10), 2)
    
    ci_at = random_date_past(730)
    exp_date = ci_at.date() + timedelta(days=itm.default_expiry_days)
    
    # Simple hex RFID string
    rfid = f"TAG{i:04d}{random.randint(1000,9999)}"
    
    ci = models.Checkin(
        rfid_tag=rfid,
        item_id=itm.id,
        quantity=qty,
        purchase_price=buy_price,
        expiry_date=exp_date,
        checked_in_at=ci_at,
        is_checked_out=False
    )
    db.add(ci)
    checked_in.append(ci)

db.commit()

# Now check out ~85% of them
checkouts_to_make = int(TOTAL_CHECKINS * 0.85)
lots_to_checkout = random.sample(checked_in, checkouts_to_make)

for ci in lots_to_checkout:
    # Held for 5 to 60 days
    days_held = random.randint(5, 60)
    co_at = ci.checked_in_at + timedelta(days=days_held)
    
    # If the simulated checkout date is in the future, cap it to now
    if co_at > datetime.utcnow():
        co_at = datetime.utcnow()
        days_held = (co_at.date() - ci.checked_in_at.date()).days
    
    # Selling price gives 5% to 25% profit usually, sometimes a loss
    margin = random.uniform(-0.05, 0.25)
    sell_price = round(ci.purchase_price * (1 + margin), 2)
    
    holding_cost = ci.item.holding_cost_per_day * days_held * ci.quantity
    profit = (sell_price * ci.quantity) - (ci.purchase_price * ci.quantity) - holding_cost
    
    co = models.Checkout(
        checkin_id=ci.id,
        selling_price=sell_price,
        checked_out_at=co_at,
        days_held=days_held,
        profit_loss=round(profit, 2)
    )
    db.add(co)
    ci.is_checked_out = True

db.commit()
db.close()

print(f"Success! Seeded {TOTAL_CHECKINS} checkins and {checkouts_to_make} checkouts over the last 2 years.")
