import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import time
from rpi_rf import RFDevice

# config
MODEL_PATH = 'efficientdet.tflite'
RF_GPIO = 17
SCORE_THRESHOLD = 0.50  # wont alert of things unsure
DETECTION_COOLDOWN = 3  # rf cooldown

# init rf
rfdevice = RFDevice(RF_GPIO)
rfdevice.enable_tx()

# init mediapipe
base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
options = vision.ObjectDetectorOptions(
    base_options=base_options,
    score_threshold=SCORE_THRESHOLD,
    max_results=5 
)
detector = vision.ObjectDetector.create_from_options(options)

# init camera for processing
cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

last_alert_time = 0

print("[info] Ready")

try:
    while cap.isOpened():
        success, frame = cap.read()
        if not success: break

        # webcam so convert to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        detection_result = detector.detect(mp_image)

        current_time = time.time()
        
        # detect more than just people
        person_count = 0
        found_dog = False
        found_cat = False
        found_car = False

        # loop all detected objects
        for detection in detection_result.detections:
            label = detection.categories[0].category_name
            score = detection.categories[0].score

            if label == "person":
                person_count += 1
            elif label == "dog":
                found_dog = True
            elif label == "cat":
                found_cat = True
            elif label == "car":
                found_car = True

        # select priority
        rf_code = 0
        log_message = ""

        if person_count > 0:
            rf_code = person_count 
            log_message = f"INTRUDER: {person_count} Person(s)"
        elif found_dog:
            rf_code = 50           
            log_message = "ANIMAL: Dog detected"
        elif found_cat:
            rf_code = 60           
            log_message = "ANIMAL: Cat detected"
        elif found_car:
            rf_code = 70           
            log_message = "VEHICLE: Car detected"

        # transmit if cooldown has passed and something was found
        if rf_code > 0:
            
            print(f"[{time.strftime('%H:%M:%S')}] {log_message}")
            
            if (current_time - last_alert_time > DETECTION_COOLDOWN):
                print(f">>> TRANSMIT RF {rf_code}")
                rfdevice.tx_code(rf_code, 1, 350)
                last_alert_time = current_time

        # debug save image
        cv2.imwrite("secure_capture.jpg", frame)

        # 20fps cap and handle opencv weirdness
        if cv2.waitKey(50) & 0xFF == ord('q'):
            break

except KeyboardInterrupt:
    print("\ndisarm")
finally:
    cap.release()
    rfdevice.cleanup()