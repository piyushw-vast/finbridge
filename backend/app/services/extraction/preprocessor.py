import cv2
import numpy as np
import base64
from pathlib import Path


def preprocess_image(image_bytes: bytes) -> tuple[bytes, dict]:
    """
    Preprocess invoice image for better extraction accuracy.
    Returns processed image bytes and quality metrics.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return image_bytes, {"quality_score": 0.5, "steps_applied": []}

    steps_applied = []
    original_shape = img.shape

    # Convert to grayscale for processing
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Assess image quality
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    quality_score = min(1.0, laplacian_var / 500.0)

    # Deskew
    img = _deskew(img)
    steps_applied.append("deskew")

    # Denoise
    img = cv2.fastNlMeansDenoisingColored(img, None, 10, 10, 7, 21)
    steps_applied.append("denoise")

    # Sharpen
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    img = cv2.filter2D(img, -1, kernel)
    steps_applied.append("sharpen")

    # Contrast enhancement (CLAHE on L channel)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    lab = cv2.merge((l, a, b))
    img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    steps_applied.append("contrast_enhance")

    _, buffer = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 95])
    processed_bytes = buffer.tobytes()

    return processed_bytes, {
        "quality_score": round(quality_score, 3),
        "steps_applied": steps_applied,
        "original_size": f"{original_shape[1]}x{original_shape[0]}",
    }


def _deskew(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.bitwise_not(gray)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) < 5:
        return img
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    # Only deskew if angle is significant
    if abs(angle) < 0.5 or abs(angle) > 45:
        return img
    h, w = img.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return rotated


def image_to_base64(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


def pdf_to_images(pdf_bytes: bytes) -> list[bytes]:
    """Convert PDF pages to images. Returns list of image bytes."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        images = []
        for page in doc:
            mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better quality
            pix = page.get_pixmap(matrix=mat)
            images.append(pix.tobytes("jpeg"))
        doc.close()
        return images
    except ImportError:
        # If PyMuPDF not available, return empty — Claude can handle PDFs natively
        return []
