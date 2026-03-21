/**
 * PythonProctor: Sends webcam frames to the FastAPI backend via WebSocket.
 * The backend runs OpenCV + MediaPipe + YOLOv8 and returns violation events.
 */
export class LocalProctor {
  constructor(videoElement, onViolation, onStatusChange) {
    this.videoElement = videoElement;
    this.onViolation = onViolation;
    this.onStatusChange = onStatusChange; // callback(isConnected: bool)
    this.score = 10.0;
    this.isActive = false;
    this.ws = null;
    this.intervalId = null;

    // Offscreen canvas for capturing video frames
    this.canvas = document.createElement('canvas');
    this.canvas.width = 320;
    this.canvas.height = 240;
    this.ctx = this.canvas.getContext('2d');
  }

  async start(sessionId) {
    this.isActive = true;

    try {
      this.ws = new WebSocket('ws://localhost:8000/ws/proctor');
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('[Proctor] Connected to Python CV backend.');
        this.ws.send(JSON.stringify({ session_id: sessionId || null }));
        if (this.onStatusChange) this.onStatusChange(true);

        // Start sending frames
        this.intervalId = setInterval(() => {
          this._captureAndSendFrame();
        }, 800);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.violation && data.status) {
            this.score = data.current_score ?? this.score;
            console.warn('[Proctor] Violation:', data.status, '| Score:', this.score);
            if (this.onViolation) {
              this.onViolation(data.status, this.score.toFixed(1));
            }
          }
        } catch (e) {
          console.error('[Proctor] Message parse error:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[Proctor] WebSocket error. Backend may not have CV dependencies.', err);
        if (this.onStatusChange) this.onStatusChange(false);
        this._stopFrameCapture();
      };

      this.ws.onclose = () => {
        console.log('[Proctor] Disconnected from Python CV backend.');
        if (this.onStatusChange) this.onStatusChange(false);
        this._stopFrameCapture();
      };

    } catch (err) {
      console.error('[Proctor] Failed to initialize WebSocket:', err);
      if (this.onStatusChange) this.onStatusChange(false);
    }
  }

  _captureAndSendFrame() {
    if (!this.isActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.videoElement || this.videoElement.readyState < 2) return;

    try {
      this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);

      this.canvas.toBlob((blob) => {
        if (!blob || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        blob.arrayBuffer().then(buffer => {
          this.ws.send(buffer);
        });
      }, 'image/jpeg', 0.7);

    } catch (err) {
      console.error('[Proctor] Frame capture error:', err);
    }
  }

  _stopFrameCapture() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  stop() {
    this.isActive = false;
    this._stopFrameCapture();
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    if (this.onStatusChange) this.onStatusChange(false);
  }

  getFinalScore() {
    return this.score;
  }
}
