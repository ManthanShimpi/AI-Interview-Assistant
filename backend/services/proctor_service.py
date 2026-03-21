import cv2
import numpy as np
import time
import urllib.request
import os

# ── Model file paths ──────────────────────────────────────────────────────────
_SERVICE_DIR      = os.path.dirname(__file__)
FACE_MODEL_PATH   = os.path.join(_SERVICE_DIR, "face_landmarker.task")
FACE_MODEL_URL    = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task"
)

# ── Lazy-loaded singletons ───────────────────────────────────────────────────
_face_landmarker  = None
_yolo_model       = None
_models_loaded    = False


def _ensure_models_loaded():
    global _face_landmarker, _yolo_model, _models_loaded
    if _models_loaded:
        return

    # ── Download MediaPipe FaceLandmarker model once (~3 MB) ────────────────
    if not os.path.exists(FACE_MODEL_PATH):
        print("[Proctor] Downloading MediaPipe FaceLandmarker model (~3 MB)…")
        urllib.request.urlretrieve(FACE_MODEL_URL, FACE_MODEL_PATH)
        print("[Proctor] Model saved to", FACE_MODEL_PATH)

    # ── Build FaceLandmarker with new Tasks API (mediapipe >= 0.10.30) ───────
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision

    base_options = mp_python.BaseOptions(model_asset_path=FACE_MODEL_PATH)
    options = mp_vision.FaceLandmarkerOptions(
        base_options=base_options,
        num_faces=2,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )
    _face_landmarker = mp_vision.FaceLandmarker.create_from_options(options)

    # ── YOLOv8 nano for phone detection ─────────────────────────────────────
    from ultralytics import YOLO
    _yolo_model = YOLO("yolov8n.pt")

    _models_loaded = True
    print("[Proctor] MediaPipe FaceLandmarker + YOLOv8 loaded OK.")


def analyze_frame(frame_bytes: bytes, state: dict) -> dict:
    """
    Analyze a single JPEG frame using MediaPipe FaceLandmarker + YOLOv8.

    Landmark indices match the original 468-point FaceMesh mesh:
      nose=1, left_cheek=234, right_cheek=454, chin=152,
      left_eye=33, right_eye=263

    Args:
        frame_bytes : Raw JPEG bytes from the browser.
        state       : Persistent timing state dict (mutated in-place).

    Returns:
        dict: status, violation (bool), score_deduction (float), faces (int)
    """
    _ensure_models_loaded()

    # ── Decode ───────────────────────────────────────────────────────────────
    arr   = np.frombuffer(frame_bytes, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        return {"status": "decode_error", "violation": False, "score_deduction": 0.0, "faces": 0}

    frame = cv2.flip(frame, 1)
    rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    now   = time.time()

    status          = "Normal"
    score_deduction = 0.0
    phone_detected  = False

    # Ensure state keys
    state.setdefault("look_away_start",  None)
    state.setdefault("look_down_start",  None)
    state.setdefault("no_face_start",    None)

    # ── YOLOv8 — Phone detection ─────────────────────────────────────────────
    yolo_results = _yolo_model(frame, verbose=False)
    for r in yolo_results:
        for box in r.boxes:
            if _yolo_model.names[int(box.cls[0])] == "cell phone":
                phone_detected = True
                break

    # ── MediaPipe FaceLandmarker ─────────────────────────────────────────────
    import mediapipe as mp
    mp_image    = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    mp_result   = _face_landmarker.detect(mp_image)

    face_count = len(mp_result.face_landmarks) if mp_result.face_landmarks else 0

    if face_count == 0:
        if state["no_face_start"] is None:
            state["no_face_start"] = now
        elif now - state["no_face_start"] > 2.0:
            status          = "Cheating (No Face Detected)"
            score_deduction = 0.5
    else:
        state["no_face_start"] = None

        if face_count > 1:
            status          = "Cheating (Multiple Faces)"
            score_deduction = 1.0
        else:
            lm = mp_result.face_landmarks[0]

            nose        = lm[1]
            left_cheek  = lm[234]
            right_cheek = lm[454]
            chin        = lm[152]
            left_eye    = lm[33]
            right_eye   = lm[263]

            # ── Horizontal gaze (left / right) ───────────────────────────────
            face_center     = (left_cheek.x + right_cheek.x) / 2
            horizontal_diff = nose.x - face_center

            if abs(horizontal_diff) > 0.08:
                status          = "Cheating (Looking Extreme Side)"
                score_deduction = 1.0
                state["look_away_start"] = None
            elif abs(horizontal_diff) > 0.04:
                if state["look_away_start"] is None:
                    state["look_away_start"] = now
                elif now - state["look_away_start"] > 1.5:
                    status          = "Suspicious (Looking Side)"
                    score_deduction = 0.5
            else:
                state["look_away_start"] = None

            # ── Vertical gaze (looking down) ─────────────────────────────────
            eye_level    = (left_eye.y + right_eye.y) / 2
            nose_to_eye  = nose.y - eye_level
            chin_to_nose = chin.y - nose.y
            ratio        = nose_to_eye / chin_to_nose if chin_to_nose != 0 else 0

            if ratio > 0.6:
                if state["look_down_start"] is None:
                    state["look_down_start"] = now
                elif now - state["look_down_start"] > 2.0:
                    status          = "Suspicious (Looking Down)"
                    score_deduction = max(score_deduction, 0.5)
            else:
                state["look_down_start"] = None

                # ── Eye contact check ─────────────────────────────────────────
                eye_center = (left_eye.x + right_eye.x) / 2
                if abs(eye_center - nose.x) > 0.035:
                    status          = "Suspicious (No Eye Contact)"
                    score_deduction = max(score_deduction, 0.3)

    # ── Hard overrides ───────────────────────────────────────────────────────
    if phone_detected:
        status          = "Cheating (Phone Detected)"
        score_deduction = 2.0
    elif face_count > 1:
        status          = "Cheating (Multiple Faces)"
        score_deduction = 1.0

    return {
        "status"         : status,
        "violation"      : status != "Normal",
        "score_deduction": score_deduction,
        "faces"          : face_count
    }
