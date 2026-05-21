# RFID Inventory Management System - Setup Guide

## Overview

This is a complete RFID-based inventory management dashboard that runs locally on one machine. It tracks inventory using RFID tags from an Arduino RC522 reader connected via USB serial port.

**Tech Stack:**
- Backend: Python, FastAPI, Uvicorn
- Database: SQLite with SQLAlchemy ORM
- Serial Communication: pyserial
- Frontend: React + Vite, Tailwind CSS, Recharts, React Query

---

## File Structure

```
g:\Desktop\trial\
├── venv/                      # Python virtual environment
├── frontend/                  # React + Vite app
│   ├── src/
│   │   ├── pages/            # React page components
│   │   ├── components/       # Reusable components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── utils/            # API utilities
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── App.css
│   ├── vite.config.js        # Vite config with API proxy
│   └── package.json
├── database.py               # SQLAlchemy setup
├── models.py                 # Database models
├── schemas.py                # Pydantic schemas
├── crud.py                   # Database operations
├── alerts.py                 # Alert/notification logic
├── serial_reader.py          # RFID reader via serial
├── main.py                   # FastAPI app
└── .env                      # Environment config (optional)
```

---

## Setup Instructions

### 1. Backend Setup

#### a) Virtual Environment (already done)
```bash
# Already created at G:\Desktop\trial\venv
```

#### b) Activate Virtual Environment
```bash
# On Windows:
cd g:\Desktop\trial
venv\Scripts\activate
```

#### c) Verify Python Packages
All packages are already installed:
```bash
# Check installed packages:
pip list
```

Expected packages:
- fastapi
- uvicorn
- sqlalchemy
- pyserial
- python-dotenv

#### d) Run Backend
```bash
# Make sure venv is activated
python main.py
```

Backend will run on **http://localhost:8000**

Visit http://localhost:8000/docs for interactive API documentation.

### 2. Frontend Setup

#### a) Install Dependencies (already done)
```bash
cd g:\Desktop\trial\frontend
npm install
```

#### b) Run Development Server
```bash
npm run dev
```

Frontend will run on **http://localhost:5173**

---

## Database

### Initialization

Database is automatically initialized on backend startup:
1. Creates SQLite file at `g:\Desktop\trial\inventory.db`
2. Creates all tables
3. Seeds 4 demo items:
   - Rice 5kg
   - Cooking Oil 1L
   - Sugar 1kg
   - Wheat Flour 2kg

### Reset Database

To reset the database and start fresh:
```bash
# Delete the existing database file:
del inventory.db

# Restart the backend - it will recreate everything
python main.py
```

---

## RFID Reader Setup

### Hardware Requirements
- Arduino board with RC522 RFID reader module
- USB cable to connect Arduino to computer

### Configuration

Edit the COM port in `main.py` (line ~113):
```python
# Initialize RFID reader (COM3 by default, can be changed)
rfid_reader = initialize_rfid_reader(port="COM3", baudrate=9600)
```

Find your Arduino COM port:
1. Connect Arduino via USB
2. Open Device Manager
3. Look under "Ports (COM & LPT)" for your Arduino port (e.g., COM3, COM4)

### Arduino Code

Your Arduino should read RFID tags and send the tag ID via serial. Example:
```cpp
#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 10
#define RST_PIN 9

MFRC522 rfid(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
}

void loop() {
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    // Print RFID tag ID
    String tagID = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      tagID += String(rfid.uid.uidByte[i], HEX);
    }
    Serial.println(tagID);
    rfid.PICC_HaltA();
  }
}
```

---

## Login Credentials

**Demo Credentials (Hardcoded):**
- Username: `admin`
- Password: `password`

To change credentials, edit `main.py`:
```python
VALID_USERNAME = "admin"
VALID_PASSWORD = "password"
```

---

## API Endpoints

### Authentication
- `POST /login` - Login with username and password

### Items
- `GET /items` - Get all items

### Checkin
- `POST /checkin` - Create new checkin
- `GET /checkins?page=1` - Get checkin history (paginated)
- `GET /checkins/count` - Get total checkin count
- `GET /checkin/{rfid_tag}` - Get unchecked-out item by RFID

### Checkout
- `POST /checkout` - Create new checkout
- `GET /checkouts?page=1` - Get checkout history (paginated)
- `GET /checkouts/count` - Get total checkout count

### Stock
- `GET /current-stock` - Get all active inventory
- `GET /working-capital` - Get total working capital

### Profit/Loss
- `GET /profit-loss` - Get profit/loss analysis and transaction history

### Notifications
- `GET /notifications` - Get recent notifications
- `PATCH /notifications/{id}` - Mark notification as read

### Real-time
- `WebSocket /ws` - WebSocket for real-time RFID scan events

---

## Running the Full Application

### Terminal 1: Backend
```bash
cd g:\Desktop\trial
venv\Scripts\activate
python main.py
```

### Terminal 2: Frontend
```bash
cd g:\Desktop\trial\frontend
npm run dev
```

### Terminal 3: (Optional) Arduino Monitor
Monitor your Arduino serial output to verify RFID reads.

---

## Features

### Home Page
- Overview of the system
- Recent notifications with alerts
- Quick guide for all features

### Checkin Tab
- Scan RFID tag for new inventory
- Enter item details (quantity, purchase price, expiry)
- Auto-fill from item defaults
- View recent checkins with pagination

### Checkout Tab
- Scan RFID tag to check out items
- Displays checkin details
- Enter selling price
- Auto-calculates profit/loss
- Shows transaction history

### Current Stock Tab
- View all active inventory
- Working capital calculation
- Item-wise summary
- Expiry status indicators
- Filter by expiry urgency

### Profit/Loss Analysis
- Total profit/loss dashboard
- Transaction history table
- Charts for profit trends
- Item-wise profit breakdown
- Cumulative profit/loss graph
- Profitability statistics

### Alerts & Notifications
- Low stock alerts (when below threshold)
- Near-expiry warnings (within 15 days)
- Already expired alerts
- Real-time notification updates

---

## Troubleshooting

### Backend won't start
```bash
# Check if port 8000 is in use:
netstat -ano | findstr :8000

# If in use, find the process ID and kill it, or change the port in main.py
```

### Frontend can't reach backend
```bash
# Ensure backend is running on localhost:8000
# Check vite.config.js proxy settings
# Verify CORS is enabled in main.py
```

### RFID reader not connecting
```bash
# Verify COM port number in main.py
# Check Arduino is connected via USB
# Ensure pyserial is installed:
pip install pyserial

# Test serial connection:
python -c "import serial; print(serial.tools.list_ports.comports())"
```

### Database errors
```bash
# Delete database and restart backend:
del inventory.db
python main.py
```

### WebSocket connection fails
```bash
# This may happen if RFID reader initialization fails
# Check backend logs for RFID reader errors
# Backend will warn but continue to run
```

---

## Development Notes

### Adding New Items
Items are seeded on startup. To add more, edit the seed data in `main.py`:
```python
seed_items = [
    schemas.ItemCreate(
        name="New Item",
        default_expiry_days=365,
        low_stock_threshold=10,
        holding_cost_per_day=0.5
    ),
]
```

### Modifying Alert Rules
Edit `alerts.py` to change alert logic:
- Low stock threshold
- Near-expiry days (currently 15)
- Alert deduplication window (currently 1 hour)

### Frontend Styling
All styling uses Tailwind CSS. Customize in `src/App.css` or component files.

### API Testing
Use the interactive Swagger UI: http://localhost:8000/docs

---

## Performance Notes

- Frontend refetch intervals: 5-15 seconds
- Database queries are optimized with indexing
- WebSocket broadcasts RFID events in real-time
- Pagination: 10 items per page
- Alert deduplication prevents duplicate notifications

---

## Production Deployment

For production use:
1. Generate strong login credentials
2. Set up HTTPS with SSL certificates
3. Configure database backups
4. Monitor RFID reader connection
5. Set up error logging
6. Use environment variables for secrets

---

## Support & Debugging

### Enable debug logging
In `main.py`, change logging level:
```python
logging.basicConfig(level=logging.DEBUG)
```

### Check API responses
Open browser developer tools (F12) and check Network tab

### Monitor database
```bash
# View database contents:
sqlite3 inventory.db
> SELECT * FROM items;
> SELECT * FROM checkins;
```

---

## License

This project is provided as-is for local inventory management use.
