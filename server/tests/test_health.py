from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["service"] == "ZeroProxy AI Service"

def test_health_ping():
    res = client.get("/health/ping")
    assert res.status_code == 200
    assert res.json()["pong"] == True

def test_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["service"] == "ZeroProxy AI Service"
    assert "database" in data
    assert "models_loaded" in data
