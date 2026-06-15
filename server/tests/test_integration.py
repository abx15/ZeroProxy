import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
API_KEY = "zeroproxy_internal_key_change_in_production"
HEADERS = {"X-API-Key": API_KEY}

def test_health_no_key():
    """Health endpoint should work without API key"""
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_face_register_no_key():
    """Face register should fail without API key"""
    res = client.post("/face/register", json={
        "user_id": "test-user",
        "company_id": "test-company",
        "image_base64": "dummy"
    })
    assert res.status_code == 422  # Missing header (FastAPI raises 422 for missing Header(...) parameter)

def test_face_register_wrong_key():
    """Face register should fail with wrong API key"""
    res = client.post(
        "/face/register",
        json={"user_id": "test", "company_id": "test", "image_base64": "dummy"},
        headers={"X-API-Key": "wrong_key"}
    )
    assert res.status_code == 403

def test_liveness_too_few_frames():
    """Liveness check should fail with < 3 frames"""
    res = client.post(
        "/liveness/check",
        json={"frames": ["frame1", "frame2"]},
        headers=HEADERS
    )
    assert res.status_code == 400

def test_liveness_too_many_frames():
    """Liveness check should fail with > 10 frames"""
    res = client.post(
        "/liveness/check",
        json={"frames": ["f"] * 11},
        headers=HEADERS
    )
    assert res.status_code == 400

def test_verify_unregistered_user():
    """Verify should return 404 for unregistered user"""
    res = client.post(
        "/face/verify",
        json={"user_id": "non-existent-uuid-123", "image_base64": "dummy"},
        headers=HEADERS
    )
    assert res.status_code == 404

def test_registration_status_not_found():
    """Status check for non-existent user"""
    res = client.get(
        "/face/register/non-existent-uuid/status",
        headers=HEADERS
    )
    assert res.status_code == 200
    assert res.json()["registered"] == False

def test_swagger_accessible():
    """Swagger docs should be accessible"""
    res = client.get("/docs")
    assert res.status_code == 200
