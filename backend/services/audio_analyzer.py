import librosa
import numpy as np
import io
import soundfile as sf
import os
import tempfile

def analyze_audio_confidence(audio_bytes: bytes) -> dict:
    """Analyze acoustic characteristics locally to determine speaker confidence."""
    # Write bytes to temp file because librosa/soundfile sometimes struggle with direct raw binary from forms
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
            temp_audio.write(audio_bytes)
            temp_file_path = temp_audio.name
            
        # Load the audio via librosa
        y, sr = librosa.load(temp_file_path, sr=None)
        os.remove(temp_file_path)
            
        # 2. Energy
        rms = librosa.feature.rms(y=y)[0]
        mean_energy = float(np.mean(rms))
        energy_variance = float(np.var(rms))
        
        # 3. Pauses
        intervals = librosa.effects.split(y, top_db=40)
        speaking_duration = sum([(end - start)/sr for start, end in intervals])
        total_duration = librosa.get_duration(y=y, sr=sr)
        pause_ratio = 1.0 - (speaking_duration / total_duration) if total_duration > 0 else 1.0

        # Heuristic 1-10 Score
        score = 7.5
        
        if pause_ratio > 0.4:
            score -= 2.0  # Many long pauses
        elif pause_ratio < 0.15:
            score += 1.5  # Solid fluency
            
        if mean_energy < 0.01:
            score -= 1.5  # Very quiet/muffled
            
        if energy_variance > 0.05:
            score -= 1.0  # Highly erratic volume
            
        score = round(max(0.0, min(10.0, score)), 1)
        
        return {
            "score": score,
            "metrics": {
                "pause_ratio": round(pause_ratio, 2),
                "mean_energy": round(mean_energy, 4)
            }
        }
    except Exception as e:
        import traceback
        print(f"Audio analysis error full trace:\n{traceback.format_exc()}")
        return {"score": 5.0, "metrics": {"error_detail": str(e)}}
