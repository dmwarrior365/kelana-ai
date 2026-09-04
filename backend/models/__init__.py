# Import all models here so Base.metadata knows about every table
# and create_all() picks them up at startup.
from models.user import User            # noqa: F401
from models.trip import Trip            # noqa: F401
from models.conversation import Conversation  # noqa: F401
from models.message import Message      # noqa: F401
