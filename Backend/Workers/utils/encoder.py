import base64
import cv2

def encode_annotated_frame(annotated_frame) -> str:
    bgr = annotated_frame[..., ::-1]
    _, buf = cv2.imencode('.jpg', bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buf).decode('utf-8')
