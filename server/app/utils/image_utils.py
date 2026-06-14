import base64
import io
import numpy as np
from PIL import Image
from fastapi import HTTPException
import cv2

MAX_SIZE_MB = 5

def decode_base64_image(base64_string: str) -> np.ndarray:
    """Decode base64 string to numpy array (BGR for OpenCV/InsightFace)"""
    try:
        # Remove data URL prefix if present
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]

        # Decode base64
        image_bytes = base64.b64decode(base64_string)

        # Check file size
        size_mb = len(image_bytes) / (1024 * 1024)
        if size_mb > MAX_SIZE_MB:
            raise HTTPException(
                status_code=400,
                detail=f"Image too large. Max size: {MAX_SIZE_MB}MB, got: {size_mb:.1f}MB"
            )

        # Open with PIL
        pil_image = Image.open(io.BytesIO(image_bytes))

        # Convert to RGB
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")

        # Convert to numpy array (RGB)
        img_array = np.array(pil_image)

        # Convert RGB to BGR for OpenCV/InsightFace
        img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

        return img_array

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image data: {str(e)}"
        )

def validate_image_size(img_array: np.ndarray, min_width: int = 112, min_height: int = 112):
    """Validate minimum image dimensions"""
    h, w = img_array.shape[:2]
    if w < min_width or h < min_height:
        raise HTTPException(
            status_code=400,
            detail=f"Image too small. Minimum: {min_width}x{min_height}px, got: {w}x{h}px"
        )

def check_image_quality(img_array: np.ndarray) -> dict:
    """
    Basic image quality checks before face detection.
    Returns quality report dict.
    """
    import cv2

    h, w = img_array.shape[:2]

    # Convert to grayscale for analysis
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

    # Blur detection using Laplacian variance
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    is_blurry = laplacian_var < 100

    # Brightness check
    mean_brightness = float(np.mean(gray))
    is_too_dark = mean_brightness < 40
    is_too_bright = mean_brightness > 220

    return {
        "width": w,
        "height": h,
        "is_blurry": is_blurry,
        "blur_score": round(laplacian_var, 2),
        "brightness": round(mean_brightness, 2),
        "is_too_dark": is_too_dark,
        "is_too_bright": is_too_bright,
        "quality_ok": not is_blurry and not is_too_dark and not is_too_bright,
    }
