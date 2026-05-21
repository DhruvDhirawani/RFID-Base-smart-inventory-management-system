from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date

# ========== Item Schemas ==========
class ItemBase(BaseModel):
    name: str
    low_stock_threshold: int = 10
    default_expiry_days: int
    holding_cost_per_day: float = 1.0


class ItemCreate(ItemBase):
    pass


class ItemResponse(ItemBase):
    id: int

    class Config:
        from_attributes = True


# ========== Checkin Schemas ==========
class CheckinBase(BaseModel):
    rfid_tag: str
    item_id: int
    quantity: int
    purchase_price: float
    expiry_date: date
    note: Optional[str] = None


class CheckinCreate(CheckinBase):
    pass


class CheckinResponse(CheckinBase):
    id: int
    checked_in_at: datetime
    is_checked_out: bool
    item: ItemResponse

    class Config:
        from_attributes = True


class CheckinDetailResponse(CheckinResponse):
    """Extended checkin with checkout details if available"""
    checkout: Optional['CheckoutResponse'] = None

    class Config:
        from_attributes = True


# ========== Checkout Schemas ==========
class CheckoutBase(BaseModel):
    checkin_id: int
    selling_price: float


class CheckoutCreate(CheckoutBase):
    pass


class CheckoutResponse(CheckoutBase):
    id: int
    checked_out_at: datetime
    days_held: int
    profit_loss: float
    checkin: Optional[CheckinResponse] = None

    class Config:
        from_attributes = True


class CheckoutDetailResponse(CheckoutResponse):
    """Full checkout details with associated checkin info"""
    class Config:
        from_attributes = True


# ========== Notification Schemas ==========
class NotificationBase(BaseModel):
    type: str  # "low_stock" or "near_expiry"
    message: str


class NotificationCreate(NotificationBase):
    pass


class NotificationResponse(NotificationBase):
    id: int
    created_at: datetime
    is_read: bool

    class Config:
        from_attributes = True


# ========== Aggregated Response Schemas ==========
class CurrentStockItem(BaseModel):
    """Item lot currently in stock"""
    checkin_id: int
    item_name: str
    rfid_tag: str
    quantity: int
    purchase_price: float
    expiry_date: date
    checked_in_at: datetime
    days_until_expiry: int
    note: Optional[str] = None


class ProfitLossRecord(BaseModel):
    """Single transaction record for profit/loss analysis"""
    checkin_id: int
    item_name: str
    rfid_tag: str
    purchase_price: float
    quantity: int
    selling_price: float
    days_held: int
    holding_cost: float
    profit_loss: float
    checked_in_at: datetime
    checked_out_at: datetime


class WorkingCapitalResponse(BaseModel):
    total_working_capital: float


class ProfitLossResponse(BaseModel):
    total_profit_loss: float


# ========== Login Schema ==========
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    message: str


# ========== Audit Log Schemas ==========
class AuditLogBase(BaseModel):
    action: str
    description: str


class AuditLogCreate(AuditLogBase):
    pass


class AuditLogResponse(AuditLogBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class AuditLogPaginatedResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    page: int
    pages: int


# ========== Reorder Request Schemas ==========
class ReorderRequestBase(BaseModel):
    item_id: int
    quantity_requested: int


class ReorderRequestCreate(ReorderRequestBase):
    pass


class ReorderRequestResponse(ReorderRequestBase):
    id: int
    generated_at: datetime
    status: str
    item: ItemResponse

    class Config:
        from_attributes = True


# ========== Analytics Schemas ==========
class TurnoverResponse(BaseModel):
    item_name: str
    turnover_rate: float
    total_sold: int
    avg_inventory: float


class DeadStockResponse(BaseModel):
    item_name: str
    rfid_tag: str
    days_in_stock: int
    quantity: int


class DemandForecastResponse(BaseModel):
    item_name: str
    current_stock: int
    avg_daily_checkout: float
    predicted_restock_date: Optional[date]


class AbcClassificationResponse(BaseModel):
    item_name: str
    total_profit: float
    profit_percentage: float
    classification: str  # A, B, or C


class DailyFlowResponse(BaseModel):
    date: date
    checkins: int
    checkouts: int


class StockTrendResponse(BaseModel):
    date: date
    item_name: str
    quantity: int
