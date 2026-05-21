from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Date, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    low_stock_threshold = Column(Integer, default=10)
    default_expiry_days = Column(Integer, nullable=False)
    holding_cost_per_day = Column(Float, default=1.0)

    checkins = relationship("Checkin", back_populates="item")


class Checkin(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    rfid_tag = Column(String, nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    purchase_price = Column(Float, nullable=False)
    expiry_date = Column(Date, nullable=False)
    checked_in_at = Column(DateTime, default=datetime.utcnow)
    note = Column(String, nullable=True)
    is_checked_out = Column(Boolean, default=False)

    item = relationship("Item", back_populates="checkins")
    checkout = relationship("Checkout", back_populates="checkin", uselist=False)


class Checkout(Base):
    __tablename__ = "checkouts"

    id = Column(Integer, primary_key=True, index=True)
    checkin_id = Column(Integer, ForeignKey("checkins.id"), nullable=False)
    selling_price = Column(Float, nullable=False)
    checked_out_at = Column(DateTime, default=datetime.utcnow)
    days_held = Column(Integer, nullable=False)
    profit_loss = Column(Float, nullable=False)

    checkin = relationship("Checkin", back_populates="checkout")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)
    message = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False)
    description = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)


class ReorderRequest(Base):
    __tablename__ = "reorder_requests"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity_requested = Column(Integer, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="PENDING")

    item = relationship("Item")