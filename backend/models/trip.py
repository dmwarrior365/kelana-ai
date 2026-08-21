from sqlalchemy import Column, Integer, String, Float
from database import Base


class Trip(Base):
    __tablename__ = "trips"

    id                      = Column(Integer, primary_key=True, index=True)
    destination             = Column(String,  nullable=False)
    days                    = Column(Integer, nullable=False)
    budget                  = Column(Float,   nullable=False)
    currency                = Column(String,  nullable=False, default="USD")
    travel_style            = Column(String,  nullable=True)
    travel_month            = Column(String,  nullable=True)
    travel_season           = Column(String,  nullable=True)
    category                = Column(String,  nullable=False)
    recommendation_transport= Column(String,  nullable=False)
    daily_budget            = Column(Float,   nullable=False)
