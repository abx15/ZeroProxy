import numpy as np
import insightface
from insightface.app import FaceAnalysis
from fastapi import HTTPException
from typing import Optional
import threading

class FaceService:
    _instance = None
    _lock = threading.Lock()
    _model: Optional[FaceAnalysis] = None
    _loaded = False

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def load_model(self):
        """Load InsightFace model — only once (singleton)"""
        if self._loaded:
            return

        print("[INFO] Loading InsightFace model (buffalo_l)... this may take a minute")
        self._model = FaceAnalysis(
            name="buffalo_l",
            providers=["CPUExecutionProvider"],  # use GPU if available: CUDAExecutionProvider
        )
        self._model.prepare(ctx_id=0, det_size=(640, 640))
        self._loaded = True
        print("[INFO] InsightFace model loaded successfully")

    def is_loaded(self) -> bool:
        return self._loaded

    def detect_faces(self, img_array: np.ndarray) -> list:
        """Detect all faces in image"""
        if not self._loaded:
            raise HTTPException(status_code=503, detail="Face model not loaded yet.")

        faces = self._model.get(img_array)
        return faces

    def get_embedding(self, img_array: np.ndarray) -> tuple[np.ndarray, float]:
        """
        Get face embedding from image.
        Returns: (embedding_512d, quality_score)
        Raises: HTTPException if no face or multiple faces detected
        """
        if not self._loaded:
            raise HTTPException(status_code=503, detail="Face model not loaded yet.")

        faces = self._model.get(img_array)

        # No face detected
        if len(faces) == 0:
            raise HTTPException(
                status_code=400,
                detail="No face detected in the image. Please ensure your face is clearly visible and well-lit."
            )

        # Multiple faces detected
        if len(faces) > 1:
            raise HTTPException(
                status_code=400,
                detail=f"Multiple faces detected ({len(faces)}). Please ensure only one person is in the frame."
            )

        face = faces[0]
        embedding = face.normed_embedding  # 512-dim normalized vector

        # Quality score from detection confidence
        quality_score = float(face.det_score)

        # Reject low quality images
        if quality_score < 0.5:
            raise HTTPException(
                status_code=400,
                detail=f"Image quality too low (score: {quality_score:.2f}). Please use better lighting and face the camera directly."
            )

        return embedding, quality_score

    def calculate_similarity(
        self,
        embedding1: np.ndarray,
        embedding2: np.ndarray
    ) -> float:
        """
        Calculate cosine similarity between two embeddings.
        Returns: float between 0.0 (different) and 1.0 (same person)
        """
        # Both should already be normalized (InsightFace returns normed embeddings)
        similarity = float(np.dot(embedding1, embedding2))
        return similarity

    def embedding_to_list(self, embedding: np.ndarray) -> list:
        """Convert numpy array to Python list for DB storage"""
        return embedding.tolist()

    def list_to_embedding(self, embedding_list: list) -> np.ndarray:
        """Convert Python list back to numpy array"""
        return np.array(embedding_list, dtype=np.float32)


# Global singleton instance
face_service = FaceService()
