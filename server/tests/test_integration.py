import os
import base64
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db, Base, engine
from app.models.face_embedding import FaceEmbedding
from app.services.face_service import face_service
from app.services.liveness_service import liveness_service

client = TestClient(app)

# Locate insightface sample images
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tests_dir = os.path.join(base_dir, "tests")
face1_path = os.path.join(tests_dir, "test_face_1.png")
face2_path = os.path.join(tests_dir, "test_face_2.png")

def get_b64_from_file(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def get_b64_from_arr(arr):
    _, buffer = cv2.imencode(".jpg", arr)
    return base64.b64encode(buffer.tobytes()).decode()

# Generate base64 images
b64_face_1 = get_b64_from_file(face1_path)
b64_face_2 = get_b64_from_file(face2_path)

# Solid black image (no face)
black_arr = np.zeros((224, 224, 3), dtype=np.uint8)
b64_no_face = get_b64_from_arr(black_arr)

# Heavily blurred image (blurry)
face1_arr = cv2.imread(face1_path)
blurry_arr = cv2.GaussianBlur(face1_arr, (45, 45), 0)
b64_blurry = get_b64_from_arr(blurry_arr)


@pytest.fixture(scope="module", autouse=True)
def cleanup_db():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    # Ensure models are loaded
    face_service.load_model()
    liveness_service.load_model()
    # Cleanup test users before running tests
    db = next(get_db())
    try:
        db.query(FaceEmbedding).filter(FaceEmbedding.user_id.in_(["test-user-1", "test-user-2"])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
    
    yield

    # Cleanup test users after running tests
    db = next(get_db())
    try:
        db.query(FaceEmbedding).filter(FaceEmbedding.user_id.in_(["test-user-1", "test-user-2"])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def test_health_check_models_loaded():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["models_loaded"] is True


def test_register_face_success():
    payload = {
        "user_id": "test-user-1",
        "company_id": "test-company-1",
        "image_base64": b64_face_1
    }
    res = client.post("/face/register", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["user_id"] == "test-user-1"
    assert data["quality_score"] > 0.5


def test_register_status_true():
    res = client.get("/face/register/test-user-1/status")
    assert res.status_code == 200
    data = res.json()
    assert data["user_id"] == "test-user-1"
    assert data["registered"] is True
    assert data["quality_score"] > 0.5


def test_register_face_re_register():
    payload = {
        "user_id": "test-user-1",
        "company_id": "test-company-1",
        "image_base64": b64_face_1
    }
    res = client.post("/face/register", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "re-registered" in data["message"]


def test_register_no_face_fails():
    payload = {
        "user_id": "test-user-2",
        "company_id": "test-company-1",
        "image_base64": b64_no_face
    }
    res = client.post("/face/register", json=payload)
    assert res.status_code == 400
    data = res.json()
    assert "No face detected" in data["detail"]


def test_verify_face_success():
    payload = {
        "user_id": "test-user-1",
        "image_base64": b64_face_1
    }
    res = client.post("/face/verify", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["verified"] is True
    assert data["confidence"] > 0.8  # same image, should be near 1.0


def test_verify_face_different_person_fails():
    payload = {
        "user_id": "test-user-1",
        "image_base64": b64_face_2
    }
    res = client.post("/face/verify", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["verified"] is False
    assert data["confidence"] < 0.5  # different person, should be low


def test_verify_unregistered_user_404():
    payload = {
        "user_id": "test-user-nonexistent",
        "image_base64": b64_face_1
    }
    res = client.post("/face/verify", json=payload)
    assert res.status_code == 404
    data = res.json()
    assert "No face registration found" in data["detail"]


def test_verify_blurry_image_400():
    payload = {
        "user_id": "test-user-1",
        "image_base64": b64_blurry
    }
    res = client.post("/face/verify", json=payload)
    assert res.status_code == 400
    data = res.json()
    assert "image is blurry" in data["detail"]


def test_compare_faces_success():
    payload = {
        "image1_base64": b64_face_1,
        "image2_base64": b64_face_1
    }
    res = client.post("/face/compare", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["same_person"] is True
    assert data["similarity"] > 0.8


def test_compare_faces_different():
    payload = {
        "image1_base64": b64_face_1,
        "image2_base64": b64_face_2
    }
    res = client.post("/face/compare", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["same_person"] is False
    assert data["similarity"] < 0.5


def test_threshold_info():
    res = client.get("/face/verify/threshold")
    assert res.status_code == 200
    data = res.json()
    assert data["current_threshold"] == 0.5
    assert "strict" in data


def test_get_company_registrations():
    res = client.get("/face/register/company/test-company-1")
    assert res.status_code == 200
    data = res.json()
    assert data["company_id"] == "test-company-1"
    assert data["total_registered"] == 1
    assert data["users"][0]["user_id"] == "test-user-1"


def test_deactivate_registration_success():
    res = client.delete("/face/register/test-user-1")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "deactivated" in data["message"]


def test_status_after_deactivation():
    res = client.get("/face/register/test-user-1/status")
    assert res.status_code == 200
    data = res.json()
    assert data["registered"] is False


def test_liveness_info():
    res = client.get("/liveness/info")
    assert res.status_code == 200
    data = res.json()
    assert data["model"] == "MediaPipe FaceMesh"
    assert data["model_loaded"] is True


def test_liveness_single_frame_success():
    res = client.post("/liveness/check/single", json={"image_base64": b64_face_1})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["face_detected"] is True
    assert "head_pose" in data


def test_liveness_single_frame_no_face_fails():
    res = client.post("/liveness/check/single", json={"image_base64": b64_no_face})
    assert res.status_code == 400
    data = res.json()
    assert "No face detected" in data["detail"]


def test_liveness_check_fail_same_photo():
    payload = {
        "frames": [b64_face_1] * 5
    }
    res = client.post("/liveness/check", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["is_live"] is False
    assert "spoofing" in data["message"]


def test_liveness_check_too_few_frames():
    payload = {
        "frames": [b64_face_1] * 2
    }
    res = client.post("/liveness/check", json=payload)
    assert res.status_code == 422
    data = res.json()
    assert "detail" in data


def test_liveness_check_too_many_frames():
    payload = {
        "frames": [b64_face_1] * 11
    }
    res = client.post("/liveness/check", json=payload)
    assert res.status_code == 422
    data = res.json()
    assert "detail" in data
