import requests
import base64
import json
import urllib.request
import cv2
import numpy as np

BASE_URL = "http://localhost:8000"

def b64_from_url(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        return base64.b64encode(response.read()).decode()

def b64_from_cv2(img):
    _, buffer = cv2.imencode('.jpg', img)
    return base64.b64encode(buffer).decode()

print("Loading local test face image...")
with open("tests/test_face_1.png", "rb") as f:
    face_bytes = f.read()
face_b64 = base64.b64encode(face_bytes).decode()

nparr = np.frombuffer(face_bytes, np.uint8)
face_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

# Generate a solid black image to act as a landscape (no face) image
black_img = np.zeros((200, 200, 3), dtype=np.uint8)
_, buffer = cv2.imencode('.jpg', black_img)
landscape_b64 = base64.b64encode(buffer).decode()

moved_img1 = np.roll(face_img, 5, axis=1) # shift right
moved_img2 = np.roll(face_img, -5, axis=1) # shift left
moved_img3 = np.roll(face_img, 10, axis=0) # shift down
moved_img4 = np.roll(face_img, -10, axis=0) # shift up

print("--- TEST 1: Health check ---")
res1 = requests.get(f"{BASE_URL}/health")
print(res1.status_code, res1.json())

print("\n--- TEST 2: Liveness info ---")
res2 = requests.get(f"{BASE_URL}/liveness/info")
print(res2.status_code, "models loaded:", res2.json().get("model_loaded"))

print("\n--- TEST 3: Single frame analysis ---")
res3 = requests.post(f"{BASE_URL}/liveness/check/single", json={"image_base64": face_b64})
print(res3.status_code, res3.json())

print("\n--- TEST 4: Same photo 5 times ---")
res4 = requests.post(f"{BASE_URL}/liveness/check", json={"frames": [face_b64]*5})
print(res4.status_code, res4.json())

print("\n--- TEST 5: Detailed analysis ---")
res5 = requests.post(f"{BASE_URL}/liveness/check/detailed", json={"frames": [face_b64]*5})
print(res5.status_code, res5.json())

print("\n--- TEST 6: Too few frames ---")
res6 = requests.post(f"{BASE_URL}/liveness/check", json={"frames": [face_b64]*2})
print(res6.status_code, res6.json())

print("\n--- TEST 7: Too many frames ---")
res7 = requests.post(f"{BASE_URL}/liveness/check", json={"frames": [face_b64]*11})
print(res7.status_code, res7.json())

print("\n--- TEST 8: No face in frame ---")
res8 = requests.post(f"{BASE_URL}/liveness/check/single", json={"image_base64": landscape_b64})
print(res8.status_code, res8.json())

print("\n--- TEST 9: Swagger docs check ---")
res9 = requests.get(f"{BASE_URL}/docs")
print(res9.status_code, "Docs content len:", len(res9.text))

print("\n--- TEST 10: Liveness with movement ---")
frames_mixed = [
    face_b64,
    b64_from_cv2(moved_img1),
    b64_from_cv2(moved_img3),
    b64_from_cv2(moved_img2),
    b64_from_cv2(moved_img4)
]
res10 = requests.post(f"{BASE_URL}/liveness/check", json={"frames": frames_mixed})
print(res10.status_code, res10.json())
