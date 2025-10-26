#!/usr/bin/env python3
"""
Vosk Speech Recognition Script
Used by Node.js backend for self-hosted STT
"""
import sys
import json
import wave
from vosk import Model, KaldiRecognizer

def transcribe_audio(audio_path, model_path):
    """Transcribe audio file using Vosk"""
    try:
        # Load Vosk model
        model = Model(model_path)
        
        # Open audio file
        wf = wave.open(audio_path, "rb")
        
        # Check audio format
        if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getcomptype() != "NONE":
            print(json.dumps({"error": "Audio must be WAV format mono PCM."}), file=sys.stderr)
            return {"text": "", "confidence": 0}
        
        # Create recognizer
        rec = KaldiRecognizer(model, wf.getframerate())
        rec.SetWords(True)
        
        # Process audio
        results = []
        while True:
            data = wf.readframes(4000)
            if len(data) == 0:
                break
            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                if 'text' in result and result['text']:
                    results.append(result['text'])
        
        # Get final result
        final_result = json.loads(rec.FinalResult())
        if 'text' in final_result and final_result['text']:
            results.append(final_result['text'])
        
        # Combine all text
        full_text = ' '.join(results).strip()
        
        return {
            "text": full_text,
            "confidence": 0.8 if full_text else 0
        }
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return {"text": "", "confidence": 0}

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: vosk_transcribe.py <audio_file> <model_path>"}))
        sys.exit(1)
    
    audio_file = sys.argv[1]
    model_path = sys.argv[2]
    
    result = transcribe_audio(audio_file, model_path)
    print(json.dumps(result))






