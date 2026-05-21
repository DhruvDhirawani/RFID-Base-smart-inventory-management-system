from database import SessionLocal
import models

def fix_profit():
    db = SessionLocal()
    try:
        checkouts = db.query(models.Checkout).all()
        fixed_count = 0
        for checkout in checkouts:
            checkin = checkout.checkin
            if not checkin:
                continue
            item = checkin.item
            if not item:
                continue
                
            # Quantity
            qty = checkin.quantity
            
            # Days held is already stored in checkout.days_held, but recalculating just in case
            days_held = checkout.days_held
            
            # Cost per unit
            buy_price = checkin.purchase_price
            sell_price = checkout.selling_price
            
            # Holding cost per day (per unit)
            holding_cost_per_day = item.holding_cost_per_day
            
            # Old logic was:
            # profit = sell_price - buy_price - (holding_cost_per_day * days_held)
            
            # New logic is:
            # profit = (sell_price * qty) - (buy_price * qty) - (holding_cost_per_day * days_held * qty)
            
            total_sell = sell_price * qty
            total_buy = buy_price * qty
            total_holding = holding_cost_per_day * days_held * qty
            
            new_profit_loss = total_sell - total_buy - total_holding
            
            # Check if it's different
            if abs(checkout.profit_loss - new_profit_loss) > 0.01:
                print(f"Updating checkout {checkout.id} (Item: {item.name}, Qty: {qty}): Old P&L {checkout.profit_loss} -> New P&L {new_profit_loss}")
                checkout.profit_loss = new_profit_loss
                fixed_count += 1
                
        if fixed_count > 0:
            db.commit()
            print(f"Successfully updated {fixed_count} records.")
        else:
            print("All records are already using the correct calculation.")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_profit()
