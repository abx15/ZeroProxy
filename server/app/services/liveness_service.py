import numpy as np
import mediapipe as mp
from fastapi import HTTPException
from typing import List
import threading

class LivenessService:
    _instance = None
    _lock = threading.Lock()
    _loaded = False

    # MediaPipe components
    _face_mesh = None
    _mp_face_mesh = None

    # Landmark indices
    LEFT_EYE_TOP = 159
    LEFT_EYE_BOTTOM = 145
    LEFT_EYE_LEFT = 33
    LEFT_EYE_RIGHT = 133

    RIGHT_EYE_TOP = 386
    RIGHT_EYE_BOTTOM = 374
    RIGHT_EYE_LEFT = 362
    RIGHT_EYE_RIGHT = 263

    NOSE_TIP = 4
    CHIN = 152
    LEFT_CHEEK = 234
    RIGHT_CHEEK = 454

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def load_model(self):
        """Load MediaPipe FaceMesh — only once"""
        if self._loaded:
            return

        print("[INFO] Loading MediaPipe FaceMesh model...")
        self._mp_face_mesh = mp.solutions.face_mesh
        self._face_mesh = self._mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
        )
        self._loaded = True
        print("[INFO] MediaPipe FaceMesh loaded successfully")

    def is_loaded(self) -> bool:
        return self._loaded

    def _get_landmarks(self, img_array: np.ndarray):
        """Get face landmarks from image"""
        if not self._loaded:
            raise HTTPException(status_code=503, detail="Liveness model not loaded.")

        import cv2
        # Convert RGB to BGR for MediaPipe
        rgb_image = cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB) if len(img_array.shape) == 3 else img_array

        results = self._face_mesh.process(rgb_image)

        if not results.multi_face_landmarks:
            return None

        return results.multi_face_landmarks[0].landmark

    def _calculate_ear(self, landmarks, eye_top_idx, eye_bottom_idx, eye_left_idx, eye_right_idx) -> float:
        """
        Calculate Eye Aspect Ratio (EAR).
        EAR < 0.25 means eye is closed (blink detected).
        """
        top = landmarks[eye_top_idx]
        bottom = landmarks[eye_bottom_idx]
        left = landmarks[eye_left_idx]
        right = landmarks[eye_right_idx]

        vertical_dist = abs(top.y - bottom.y)
        horizontal_dist = abs(left.x - right.x)

        if horizontal_dist == 0:
            return 0.0

        ear = vertical_dist / horizontal_dist
        return ear

    def _calculate_head_pose(self, landmarks) -> dict:
        """
        Estimate head pose (left/right/up/down tilt).
        Returns relative movement indicators.
        """
        nose = landmarks[self.NOSE_TIP]
        chin = landmarks[self.CHIN]
        left_cheek = landmarks[self.LEFT_CHEEK]
        right_cheek = landmarks[self.RIGHT_CHEEK]

        # Horizontal ratio — nose position relative to cheeks
        face_width = abs(right_cheek.x - left_cheek.x)
        nose_offset_x = nose.x - (left_cheek.x + right_cheek.x) / 2

        # Vertical ratio — nose position relative to chin
        face_height = abs(chin.y - nose.y)

        horizontal_ratio = nose_offset_x / face_width if face_width > 0 else 0
        vertical_ratio = face_height

        return {
            "horizontal_ratio": round(horizontal_ratio, 4),
            "vertical_ratio": round(vertical_ratio, 4),
            "nose_x": round(nose.x, 4),
            "nose_y": round(nose.y, 4),
        }

    def analyze_frame(self, img_array: np.ndarray) -> dict:
        """
        Analyze single frame for liveness indicators.
        Returns EAR values and head pose.
        """
        landmarks = self._get_landmarks(img_array)

        if landmarks is None:
            return {
                "face_detected": False,
                "left_ear": None,
                "right_ear": None,
                "avg_ear": None,
                "eye_closed": False,
                "head_pose": None,
            }

        left_ear = self._calculate_ear(
            landmarks,
            self.LEFT_EYE_TOP,
            self.LEFT_EYE_BOTTOM,
            self.LEFT_EYE_LEFT,
            self.LEFT_EYE_RIGHT,
        )

        right_ear = self._calculate_ear(
            landmarks,
            self.RIGHT_EYE_TOP,
            self.RIGHT_EYE_BOTTOM,
            self.RIGHT_EYE_LEFT,
            self.RIGHT_EYE_RIGHT,
        )

        avg_ear = (left_ear + right_ear) / 2
        eye_closed = avg_ear < 0.25  # blink threshold

        head_pose = self._calculate_head_pose(landmarks)

        return {
            "face_detected": True,
            "left_ear": round(left_ear, 4),
            "right_ear": round(right_ear, 4),
            "avg_ear": round(avg_ear, 4),
            "eye_closed": eye_closed,
            "head_pose": head_pose,
        }

    def check_liveness_from_frames(self, frame_analyses: List[dict]) -> dict:
        """
        Analyze multiple frame results to determine liveness.

        Liveness indicators:
        1. Blink detected — EAR drops below 0.25 in at least 1 frame
        2. Head movement — nose position changes across frames
        3. EAR variation — natural micro-movements in real faces

        A static printed photo will have:
        - No blink (EAR stays constant)
        - No head movement
        - Very low EAR variance
        """
        valid_frames = [f for f in frame_analyses if f["face_detected"]]

        if len(valid_frames) < 3:
            return {
                "is_live": False,
                "confidence": 0.0,
                "reason": f"Not enough valid frames with face detected. Got {len(valid_frames)}, need at least 3.",
                "details": {},
            }

        # ── Check 1: Blink Detection ──────────────────────
        ear_values = [f["avg_ear"] for f in valid_frames if f["avg_ear"] is not None]
        min_ear = min(ear_values)
        max_ear = max(ear_values)
        ear_variance = max_ear - min_ear
        blink_detected = min_ear < 0.25 or ear_variance > 0.08

        # ── Check 2: Head Movement ────────────────────────
        poses = [f["head_pose"] for f in valid_frames if f["head_pose"] is not None]
        nose_x_values = [p["nose_x"] for p in poses]
        nose_y_values = [p["nose_y"] for p in poses]

        nose_x_range = max(nose_x_values) - min(nose_x_values)
        nose_y_range = max(nose_y_values) - min(nose_y_values)
        head_moved = nose_x_range > 0.01 or nose_y_range > 0.01

        # ── Check 3: Natural EAR Variance ─────────────────
        if len(ear_values) > 1:
            ear_std = float(np.std(ear_values))
            natural_variance = ear_std > 0.01  # real eyes have micro-movements
        else:
            natural_variance = False

        # ── Final Decision ────────────────────────────────
        # Score: each check contributes to liveness confidence
        score = 0
        if blink_detected:
            score += 50
        if head_moved:
            score += 30
        if natural_variance:
            score += 20

        is_live = score >= 50  # at least blink OR (head movement + natural variance)
        confidence = score / 100.0

        return {
            "is_live": is_live,
            "confidence": round(confidence, 4),
            "score": score,
            "reason": self._get_liveness_reason(is_live, blink_detected, head_moved, natural_variance),
            "details": {
                "frames_analyzed": len(valid_frames),
                "blink_detected": blink_detected,
                "head_moved": head_moved,
                "natural_variance": natural_variance,
                "min_ear": round(min_ear, 4),
                "max_ear": round(max_ear, 4),
                "ear_variance": round(ear_variance, 4),
                "nose_x_range": round(nose_x_range, 4),
                "nose_y_range": round(nose_y_range, 4),
            },
        }

    def _get_liveness_reason(
        self,
        is_live: bool,
        blink: bool,
        head_moved: bool,
        natural_variance: bool,
    ) -> str:
        if is_live:
            indicators = []
            if blink:
                indicators.append("blink detected")
            if head_moved:
                indicators.append("head movement detected")
            if natural_variance:
                indicators.append("natural eye variance detected")
            return f"Liveness confirmed: {', '.join(indicators)}."
        else:
            return "Liveness check failed. Possible spoofing attempt — no natural movement detected."


# Global singleton instance
liveness_service = LivenessService()
