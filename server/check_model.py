from app.services.face_service import face_service
from app.services.liveness_service import liveness_service
import traceback

print("--- Face Service ---")
try:
    face_service.load_model()
    print("Face Service loaded successfully:", face_service.is_loaded())
except Exception as e:
    print("Face Service failed:")
    traceback.print_exc()

print("--- Liveness Service ---")
try:
    liveness_service.load_model()
    print("Liveness Service loaded successfully:", liveness_service.is_loaded())
except Exception as e:
    print("Liveness Service failed:")
    traceback.print_exc()
