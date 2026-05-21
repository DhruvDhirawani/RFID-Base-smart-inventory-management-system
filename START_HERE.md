# RFID Inventory Management - Quick Start

## Prerequisites
- Python 3.8+
- Node.js 16+
- Arduino with RC522 RFID reader (optional for testing)

## Quick Setup (5 minutes)

### 1. Start Backend
```bash
# Open Terminal 1
cd g:\Desktop\trial
venv\Scripts\activate
python main.py
```

✓ Backend running on http://localhost:8000

### 2. Start Frontend
```bash
# Open Terminal 2
cd g:\Desktop\trial\frontend
npm run dev
```

✓ Frontend running on http://localhost:5173

### 3. Open in Browser
Visit: **http://localhost:5173**

### 4. Login
- Username: `admin`
- Password: `password`

---

## What You Can Do

### 📥 Checkin
1. Go to "Checkin" tab
2. Click "New Checkin"
3. Scan RFID tag (or enter manually)
4. Select item and enter details
5. Click "Checkin"

### 📤 Checkout
1. Go to "Checkout" tab
2. Click "New Checkout"
3. Scan RFID tag
4. Enter selling price
5. Click "Checkout"

### 📦 Current Stock
View all active inventory with:
- Total quantity
- Working capital
- Expiry status
- Items by type

### 💹 Profit/Loss
See analytics:
- Total profit/loss
- Transaction history
- Charts and graphs
- Item-wise performance

### 🔔 Notifications
View alerts for:
- Low stock items
- Items expiring soon
- Already expired items

---

## Troubleshooting

### Backend won't start
```bash
# Make sure to activate venv first:
venv\Scripts\activate

# If port 8000 is in use:
# Find and kill the process using: netstat -ano | findstr :8000
```

### Frontend can't connect
```bash
# Make sure backend is running on localhost:8000
# Check browser console (F12) for errors
# Restart frontend: Ctrl+C, then npm run dev
```

### RFID reader not detected
- Connect Arduino via USB
- Check COM port in main.py (around line 113)
- Default is COM3 - verify in Device Manager
- Backend will warn but continue to work

---

## Demo Data

**Pre-loaded Items:**
1. Rice 5kg
2. Cooking Oil 1L
3. Sugar 1kg
4. Wheat Flour 2kg

**Demo Checkins Available:**
Try checking in one of these items with any RFID tag (e.g., `ABC123DEF456`)

---

## Reset Database

To start fresh:
```bash
# Delete the database file:
del g:\Desktop\trial\inventory.db

# Restart backend - it will recreate everything
python main.py
```

---

## API Documentation

Interactive API docs available at:
http://localhost:8000/docs

Try API endpoints directly from the browser!

---

## File Locations

- Backend: `g:\Desktop\trial\main.py`
- Frontend: `g:\Desktop\trial\frontend\src\App.jsx`
- Database: `g:\Desktop\trial\inventory.db` (auto-created)
- Config: `g:\Desktop\trial\main.py` (lines 25-26 for RFID port)

---

## Next Steps

1. ✓ Start both servers
2. ✓ Test checkin/checkout with sample RFID tags
3. ✓ Connect Arduino with RC522
4. ✓ Configure RFID COM port
5. ✓ Deploy to production

---

For detailed setup, see **README.md**
