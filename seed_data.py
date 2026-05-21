"""
Seed script: fills the database with 2 weeks of realistic dummy data.
Run once:  venv\Scripts\python.exe seed_data.py
Safe to re-run — it checks for existing data before inserting.
"""

from datetime import datetime, date, timedelta
from database import SessionLocal, engine, Base
import models

# ── make sure tables exist ──────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ── helpers ─────────────────────────────────────────────────────────────────
def days_ago(n: int) -> datetime:
    return datetime.utcnow() - timedelta(days=n)

def expiry_from(checkin_dt: datetime, days: int) -> date:
    return (checkin_dt + timedelta(days=days)).date()

# ── abort if already seeded ──────────────────────────────────────────────────
if db.query(models.Checkin).count() > 0:
    print("Database already has checkin data — skipping seed.")
    db.close()
    exit(0)

# ── ensure seed items exist ──────────────────────────────────────────────────
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

# fetch items by name for easy reference
def item(name):
    return db.query(models.Item).filter(models.Item.name == name).first()

rice  = item("Rice 5kg")
oil   = item("Cooking Oil 1L")
sugar = item("Sugar 1kg")
flour = item("Wheat Flour 2kg")

# ── checkin records (15 lots over 14 days) ──────────────────────────────────
#
# Format: (rfid_tag, item, quantity, purchase_price, checkin_days_ago, expiry_days, note)
#
checkin_specs = [
    # ── Week 1 ──
    ("A1B2C3D4", rice,  50, 250.00, 14, 365, "Batch from Sharma Traders"),
    ("E5F6G7H8", oil,   30, 120.00, 14, 180, "Premium refined oil"),
    ("I9J0K1L2", sugar, 40,  55.00, 13, 730, "White sugar, 40 bags"),
    ("M3N4O5P6", flour, 25,  85.00, 12, 270, "Aashirvaad brand"),
    ("Q7R8S9T0", rice,  30, 255.00, 11, 365, "Second rice lot"),
    ("U1V2W3X4", oil,   20, 125.00, 10, 180, None),
    ("Y5Z6A7B8", sugar, 35,  58.00,  8, 730, "Slightly higher rate"),
    # ── Week 2 ──
    ("C9D0E1F2", rice,  45, 248.00,  7, 365, "Bulk purchase"),
    ("G3H4I5J6", flour, 20,  88.00,  6, 270, None),
    ("K7L8M9N0", oil,   25, 122.00,  5, 180, "Fortune brand"),
    ("P1Q2R3S4", rice,  40, 252.00,  4, 365, "Regular weekly stock"),
    ("T5U6V7W8", sugar, 30,  56.00,  3, 730, None),
    ("X9Y0Z1A2", flour, 15,  90.00,  2, 270, "Small restock"),
    ("B3C4D5E6", rice,  35, 260.00,  1, 365, "Rate went up slightly"),
    # ── expiring soon — triggers near-expiry alert ──
    ("F7G8H9I0", oil,   20, 128.00,  0, 12, "Short-dated stock — discount buy"),
]

# ── Safety check: assert no duplicate RFIDs exist in current stock ────────────
# (checked-out lots are fine; the same physical tag can be reused after checkout)
in_stock_specs    = [s for s in checkin_specs if s[0] not in
                     {s2[0] for s2 in checkin_specs if s2 is not s}]
stock_rfids       = [s[0] for s in checkin_specs]          # all tags in seed
checkout_rfids    = set()                                  # will be checked below

all_seed_rfids = [s[0] for s in checkin_specs]
assert len(all_seed_rfids) == len(set(all_seed_rfids)), (
    "SEED ERROR: duplicate RFID tags found in checkin_specs — "
    f"duplicates: {[r for r in all_seed_rfids if all_seed_rfids.count(r) > 1]}"
)


checkins = {}   # rfid -> Checkin ORM object
for rfid, itm, qty, price, days, exp_days, note in checkin_specs:
    ci_at = days_ago(days)
    ci = models.Checkin(
        rfid_tag        = rfid,
        item_id         = itm.id,
        quantity        = qty,
        purchase_price  = price,
        expiry_date     = expiry_from(ci_at, exp_days),
        checked_in_at   = ci_at,
        note            = note,
        is_checked_out  = False,
    )
    db.add(ci)
    db.flush()          # get id without commit
    checkins[rfid] = ci

db.commit()

# ── checkout records (10 of the 15 lots sold) ───────────────────────────────
#
# Format: (rfid_tag, checkout_days_ago, selling_price)
#
checkout_specs = [
    ("A1B2C3D4", 11, 280.00),   # Rice: profit  28.5
    ("E5F6G7H8", 12, 140.00),   # Oil:  profit  19.4
    ("I9J0K1L2",  9,  68.00),   # Sugar: profit 12.2
    ("M3N4O5P6",  8,  95.00),   # Flour: profit  8.4
    ("Q7R8S9T0",  7, 262.00),   # Rice: profit   5.0
    ("U1V2W3X4",  6, 130.00),   # Oil:  profit   3.8
    ("Y5Z6A7B8",  4,  52.00),   # Sugar: LOSS   -6.8  (sold below cost)
    ("C9D0E1F2",  3, 270.00),   # Rice: profit  20.0
    ("G3H4I5J6",  2, 100.00),   # Flour: profit 10.4
    ("K7L8M9N0",  1, 115.00),   # Oil:  LOSS    -8.2  (price fell)
]

for rfid, co_days_ago, sell_price in checkout_specs:
    ci = checkins[rfid]
    co_at      = days_ago(co_days_ago)
    days_held  = max(0, (co_at.date() - ci.checked_in_at.date()).days)
    hold_cost  = ci.item.holding_cost_per_day * days_held
    pl         = sell_price - ci.purchase_price - hold_cost

    co = models.Checkout(
        checkin_id      = ci.id,
        selling_price   = sell_price,
        checked_out_at  = co_at,
        days_held       = days_held,
        profit_loss     = round(pl, 2),
    )
    db.add(co)
    ci.is_checked_out = True

db.commit()

# ── notifications ────────────────────────────────────────────────────────────
notifications = [
    # Historical ones (already read)
    dict(type="low_stock",   message="Low stock alert: Rice 5kg has only 8 units (threshold: 10)",
         created_at=days_ago(11), is_read=True),
    dict(type="low_stock",   message="Low stock alert: Cooking Oil 1L has only 5 units (threshold: 8)",
         created_at=days_ago(6),  is_read=True),
    dict(type="near_expiry", message="Near expiry: Cooking Oil 1L (RFID: U1V2W3X4) expires in 14 days",
         created_at=days_ago(6),  is_read=True),
    dict(type="low_stock",   message="Low stock alert: Sugar 1kg has only 5 units (threshold: 15)",
         created_at=days_ago(4),  is_read=True),
    # Recent unread ones
    dict(type="near_expiry", message="URGENT: Cooking Oil 1L (RFID: F7G8H9I0) expires in 12 days — discount purchase",
         created_at=days_ago(0),  is_read=False),
    dict(type="low_stock",   message="Low stock alert: Wheat Flour 2kg has only 15 units (threshold: 12) — consider restocking",
         created_at=days_ago(0),  is_read=False),
]

for n in notifications:
    db.add(models.Notification(**n))

db.commit()
db.close()

# ── summary ──────────────────────────────────────────────────────────────────
print("Seed complete!")
print(f"   Checkins  : 15  (10 checked out, 5 still in stock)")
print(f"   Checkouts : 10  (8 profitable, 2 losses)")
print(f"   Notifications: {len(notifications)}  (4 read, 2 unread)")
print()
print("Still in stock (all unique RFIDs):")
still_in = ["P1Q2R3S4 (Rice 5kg, 40 units)",
            "T5U6V7W8 (Sugar 1kg, 30 units)",
            "X9Y0Z1A2 (Wheat Flour 2kg, 15 units)",
            "B3C4D5E6 (Rice 5kg, 35 units)",
            "F7G8H9I0 (Cooking Oil 1L, 20 units -- expires soon!)"]
for s in still_in:
    print(f"   * {s}")
