// Dynamically load Google MediaPipe Face Detection & TensorFlow COCO-SSD (Object Detection)
let faceDetector = null;
let objectDetector = null;
let isFaceLoaded = false;
let isObjectLoaded = false;

function loadFaceDetection() {
  return new Promise((resolve) => {
    if (isFaceLoaded) return resolve();
    const script1 = document.createElement('script');
    script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection';
    const script2 = document.createElement('script');
    script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils';
    script1.onload = () => document.body.appendChild(script2);
    script2.onload = () => { isFaceLoaded = true; resolve(); };
    document.body.appendChild(script1);
  });
}

function loadObjectDetection() {
  return new Promise((resolve, reject) => {
    if (isObjectLoaded) return resolve();
    const script1 = document.createElement('script');
    script1.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs';
    const script2 = document.createElement('script');
    script2.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd';
    
    script1.onload = () => document.body.appendChild(script2);
    script2.onload = async () => {
      try {
        objectDetector = await window.cocoSsd.load();
        isObjectLoaded = true;
        resolve();
      } catch (e) {
        console.error("COCO-SSD Load Error:", e);
        reject(e);
      }
    };
    document.body.appendChild(script1);
  });
}

export class LocalProctor {
  constructor(videoElement, onViolation) {
    this.videoElement = videoElement;
    this.onViolation = onViolation;
    this.score = 10.0;
    this.isActive = false;
    this.camera = null;
    
    this.handleVisibility = this.handleVisibility.bind(this);
    this.lastDetectionTime = Date.now();
  }
  
  async start() {
    this.isActive = true;
    document.addEventListener("visibilitychange", this.handleVisibility);
    
    try {
      await loadFaceDetection();
      
      // Load Object Detection async so it doesn't block video init
      loadObjectDetection()
        .then(() => console.log("Phone Detection (COCO-SSD) active!"))
        .catch(e => console.error("CocoSSD failed to load.", e));
      
      faceDetector = new window.FaceDetection({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
      });
      
      faceDetector.setOptions({
        model: 'short',
        minDetectionConfidence: 0.5
      });
      
      faceDetector.onResults((results) => {
        if (!this.isActive) return;
        const now = Date.now();
        if (now - this.lastDetectionTime < 5000) return;
        
        if (!results.detections || results.detections.length === 0) {
          this.deductScore(0.5, "CHEATING ALERT: No face detected in camera!");
          this.lastDetectionTime = now;
        } else if (results.detections.length > 1) {
          this.deductScore(1.0, "CHEATING ALERT: Multiple faces detected on screen!");
          this.lastDetectionTime = now;
        }
      });
      
      this.camera = new window.Camera(this.videoElement, {
        onFrame: async () => {
          if (!this.isActive) return;
          
          if (faceDetector) {
            await faceDetector.send({ image: this.videoElement });
          }
          
          // Execute Object Classification to watch for Cell Phones
          if (objectDetector && this.videoElement.readyState === 4) {
            const predictions = await objectDetector.detect(this.videoElement);
            const now = Date.now();
            
            // Only trigger every 5 seconds to avoid spamming the UI
            if (now - this.lastDetectionTime > 5000) {
              for (let p of predictions) {
                if (p.class === 'cell phone') {
                  this.deductScore(2.0, "CHEATING ALERT: Mobile Phone detected in camera frame!");
                  this.lastDetectionTime = now;
                  break;
                }
              }
            }
          }
        },
        width: 640,
        height: 480
      });
      
      this.camera.start();
    } catch (err) {
      console.error("Proctoring algorithms failed to mount.", err);
    }
  }
  
  stop() {
    this.isActive = false;
    document.removeEventListener("visibilitychange", this.handleVisibility);
    if (this.camera) {
      try { this.camera.stop(); } catch(e){}
    }
  }
  
  handleVisibility() {
    if (document.hidden && this.isActive) {
      this.deductScore(1.5, "CHEATING ALERT: Applicant switched tabs or minimized browser.");
    }
  }
  
  deductScore(amount, reason) {
    this.score = Math.max(0, this.score - amount);
    if (this.onViolation) {
      this.onViolation(reason, this.score.toFixed(1));
    }
  }
  
  getFinalScore() {
    return this.score;
  }
}
