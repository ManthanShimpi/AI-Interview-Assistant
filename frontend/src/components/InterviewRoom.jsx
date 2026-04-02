import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { speakText, startSpeechRecognition } from '../utils/speech';
import { LocalProctor } from '../utils/proctoring';

export default function InterviewRoom({ sessionData, onFinish }) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cheatAlert, setCheatAlert] = useState(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [proctorConnected, setProctorConnected] = useState(false);
  
  // Microphone Selection State
  const [mics, setMics] = useState([]);
  const [selectedMic, setSelectedMic] = useState('');
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const proctorRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  const [questions, setQuestions] = useState(sessionData?.questions || []);
  const currentQuestion = questions[currentQIndex];
  
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 1. Fetch available Microphone Devices ONCE
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Must prompt permission first before we can reliably enumerate device labels
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        
        setMics(audioInputs);
        if (audioInputs.length > 0) {
          setSelectedMic(audioInputs[0].deviceId); // Set default
        }
      } catch (err) {
        console.error("Device enumeration error:", err);
      }
    };
    getDevices();
  }, []);

  // 2. Map Media Stream tracking to currently selected Microphone
  useEffect(() => {
    if (!selectedMic) return;
    
    // Cleanup old streams
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    // Connect targeted mic
    navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: { deviceId: { exact: selectedMic } } 
    })
    .then((stream) => {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Reboot Proctoring with Python CV backend
      if (proctorRef.current) proctorRef.current.stop();
      const proctor = new LocalProctor(
        videoRef.current,
        (reason, score) => {
          console.warn("Proctor Alert:", reason, "Score:", score);
          setCheatAlert(reason);
          setTimeout(() => setCheatAlert(null), 5000);
        },
        (isConnected) => setProctorConnected(isConnected)  // clean status callback
      );
      proctorRef.current = proctor;
      proctorRef.current.start(sessionData?.session_id);
    })
    .catch((err) => {
      console.error("Mic access denied", err);
    });

    return () => {
      if (proctorRef.current) proctorRef.current.stop();
    };
  }, [selectedMic]);

  // 3. Autoplay the Question using Natural Web Speech AI
  useEffect(() => {
    if (currentQuestion && isFullscreen) {
      setTimeout(() => speakText(currentQuestion.text), 1000);
    }
    return () => window.speechSynthesis.cancel();
  }, [currentQIndex, currentQuestion, isFullscreen]);

  const handleStartAnswer = () => {
    window.speechSynthesis.cancel(); 
    setTranscript('');
    setInterim('');
    setIsRecording(true);
    
    if (streamRef.current) {
      audioChunksRef.current = [];
      try {
        const options = { mimeType: 'audio/webm' };
        const isTypeSupported = window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(options.mimeType);
        
        // Extract ONLY the audio track, otherwise Chrome rejects audio/webm if video track is present
        const audioTrack = streamRef.current.getAudioTracks()[0];
        const audioStream = new MediaStream([audioTrack]);
        
        const mediaRecorder = new MediaRecorder(
          audioStream, 
          isTypeSupported ? options : undefined
        );
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
              audioChunksRef.current.push(e.data);
          }
        };
        // Use a 250ms timeslice to force chunk emission immediately
        mediaRecorder.start(250);
        mediaRecorderRef.current = mediaRecorder;
      } catch (err) {
        console.error("MediaRecorder start failed:", err);
      }
    }
    
    recognitionRef.current = startSpeechRecognition(
      (finalText, interimText) => {
        setTranscript(prev => prev + (prev && finalText ? ' ' : '') + finalText);
        setInterim(interimText);
      },
      () => {
        setIsRecording(false);
      },
      (err) => {
        setIsRecording(false);
        console.error("Speech Recog Error:", err);
        alert(`Microphone Issue: ${err}. Note: Chrome's Voice engine defaults to OS settings, so your specific UI microphone choice only routes into local WebRTC evaluation. You can bypass this by typing your answer!`);
      }
    );
  };

  const handleStopAnswer = async () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e){}
    }
    
    setIsProcessing(true);
    let audioBlob = null;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        await new Promise((resolve, reject) => {
          // Provide a timeout just in case onstop never fires
          const timeout = setTimeout(() => resolve(), 3000);
          mediaRecorderRef.current.onstop = () => {
            clearTimeout(timeout);
            if (audioChunksRef.current.length > 0) {
              audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              console.log("[DEBUG] Audio blob created. Size:", audioBlob.size, "bytes.");
            } else {
              console.warn("[DEBUG] Audio chunks are completely empty!");
            }
            resolve();
          };
          mediaRecorderRef.current.stop();
        });
      } catch (err) {
        console.error("Error stopping media recorder:", err);
      }
    }
    
    const finalAnswer = transcript + ' ' + interim;
    
    const formData = new FormData();
    formData.append('session_id', sessionData.session_id);
    formData.append('question_id', currentQuestion.id);
    formData.append('transcribed_text', finalAnswer.trim() || 'No answer provided.');
    
    if (audioBlob) {
      if (audioBlob.size > 100) {
          formData.append('audio', audioBlob, 'answer.webm');
      } else {
          console.warn("[DEBUG] Audio blob too small to send:", audioBlob.size);
      }
    }
    
    try {
      const response = await fetch('http://localhost:8000/api/answer', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Session lost! The backend server was recently restarted. Please refresh the page and upload your resume again.");
        }
        throw new Error(`Backend Error ${response.status}: Failed to evaluate answer.`);
      }
      
      const data = await response.json();
      
      setAiResponse(data.semantic_feedback);
      
      speakText(data.semantic_feedback, () => {
        setAiResponse('');
        setIsProcessing(false);
        if (data.next_question) {
          setQuestions(prev => [...prev, data.next_question]);
          setCurrentQIndex(prev => prev + 1);
          setTranscript('');
          setInterim('');
        }
      });
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to submit answer to Semantic Backend.');
      setIsProcessing(false);
    }
  };

  const finishInterview = async () => {
    const finalProctorScore = proctorRef.current ? proctorRef.current.getFinalScore() : 10.0;
    
    const formData = new FormData();
    formData.append('session_id', sessionData.session_id);
    formData.append('proctoring_score', finalProctorScore.toString());
    
    try {
      const res = await fetch('http://localhost:8000/api/report', {
        method: 'POST',
        body: formData
      });
      const reportData = await res.json();
      onFinish(reportData);
    } catch (err) {
      console.error(err);
      alert('Failed to generate final report.');
    }
  };

  if (!currentQuestion) return <div className="text-white text-center mt-20 animate-pulse">Initializing AI Resources...</div>;

  const requestFullscreen = () => {
    document.documentElement.requestFullscreen().catch(err => {
      console.error("Error attempting to enable fullscreen:", err);
      alert("Browser prevented fullscreen mode. Please ensure you clicked the button.");
    });
  };

  return (
    <>
      {!isFullscreen && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999999 }} className="bg-gray-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 m-0 overflow-hidden overscroll-none">
          <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-rose-500/30 shadow-[0_0_80px_rgba(225,29,72,0.3)] flex flex-col items-center gap-5 animate-fade-in text-white text-center">
            <div className="w-24 h-24 bg-rose-500/20 rounded-full flex items-center justify-center shadow-inner">
              <span className="text-5xl animate-pulse">⚠️</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-wide">Fullscreen Required</h2>
            <p className="text-gray-300 text-lg leading-relaxed font-medium">
              This interview operates in a strict proctored environment and <strong className="text-rose-400">requires full-screen mode</strong> to prevent unwanted tabs or applications from being opened.
            </p>
            <button 
              onClick={requestFullscreen}
              className="mt-6 px-10 py-5 bg-gradient-to-r from-rose-600 to-pink-600 rounded-2xl font-bold text-xl text-white shadow-[0_4px_20px_rgba(225,29,72,0.4)] hover:from-rose-500 hover:to-pink-500 hover:scale-105 transition-all w-full"
            >
              Enter Fullscreen to Continue
            </button>
          </div>
        </div>,
        document.body
      )}
      
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 fade-in transition-all duration-300 ${!isFullscreen ? 'pointer-events-none opacity-20 blur-md' : ''}`}>
      {/* Left Column: Proctoring & Camera */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="glass-panel rounded-3xl p-5 border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-500/30 rounded-2xl transition-all pointer-events-none"></div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-200 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${proctorConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]'}`}></span>
              Live Proctoring
            </h3>
            <span className={`text-xs px-2 py-1 rounded-md font-medium border ${proctorConnected ? 'bg-green-900/40 text-green-400 border-green-700' : 'bg-yellow-900/40 text-yellow-400 border-yellow-700'}`}>
              {proctorConnected ? 'Python CV Active' : 'Connecting...'}
            </span>
          </div>

          {cheatAlert && (
            <div className="absolute top-16 left-4 right-4 z-50 bg-red-600/90 backdrop-blur border border-red-400 text-white px-4 py-3 rounded-xl shadow-2xl animate-pulse">
              <p className="font-bold text-sm tracking-wide text-center">⚠️ {cheatAlert}</p>
            </div>
          )}
          
          {/* ── Global Cheat Alert Portal - always visible over everything ── */}
          {cheatAlert && createPortal(
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', zIndex: 999998, pointerEvents: 'none' }}
              className="flex items-start justify-center pt-8 px-6">
              <div className="w-full max-w-2xl bg-red-600 border-2 border-red-400 text-white px-6 py-5 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.7)] flex items-center gap-5 animate-pulse">
                <span className="text-4xl">🚨</span>
                <div>
                  <p className="font-black text-xl tracking-wide">PROCTORING VIOLATION</p>
                  <p className="font-semibold text-red-100 text-sm mt-1">{cheatAlert}</p>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Microphone Selector */}
          <select 
             value={selectedMic} 
             onChange={(e) => setSelectedMic(e.target.value)}
             className="w-full mb-4 bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {mics.length === 0 && <option>Searching local microphones...</option>}
            {mics.map((mic, idx) => (
              <option key={mic.deviceId} value={mic.deviceId}>
                {mic.label || `Microphone ${idx + 1}`}
              </option>
            ))}
          </select>

          <div className="relative rounded-xl overflow-hidden bg-black aspect-video ring-1 ring-gray-700 shadow-inner">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100"></video>
          </div>
        </div>
        
        <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-xl">
          <h3 className="text-sm text-gray-400 mb-3 uppercase tracking-wider font-bold">Interview Progress</h3>
          <p className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
            Topic {currentQIndex + 1}
          </p>
          <p className="text-xs text-gray-500 mt-2 font-medium">Continuing dynamically until you decide to finish.</p>
        </div>
      </div>

      {/* Right Column: Q&A Interface */}
      <div className="lg:col-span-2 flex flex-col h-full space-y-3">
        <div className="glass-panel rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl flex-grow flex flex-col relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50"></div>
          <div className="relative z-10 w-full flex flex-col h-full">
            <span className="inline-flex self-start px-3 py-1 bg-indigo-900/40 text-indigo-300 rounded-full text-xs font-bold mb-4 tracking-widest uppercase border border-indigo-700/50 shadow-sm">
              Focus: {currentQuestion.skill || 'General Background'}
            </span>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight mb-6 text-white">
              {currentQuestion.text}
            </h2>
            {aiResponse ? (
              <div className="mt-auto bg-indigo-900/40 rounded-xl p-6 md:p-8 flex-grow border border-indigo-500/30 shadow-inner flex flex-col items-center justify-center animate-fade-in text-center">
                 <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mb-6 animate-pulse border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                    <span className="text-3xl">🎙️</span>
                 </div>
                 <h3 className="text-xl md:text-2xl font-medium text-indigo-50 italic leading-relaxed shadow-sm">"{aiResponse}"</h3>
                 <p className="text-indigo-400 font-bold uppercase tracking-widest text-xs mt-6">Interviewer is speaking...</p>
              </div>
            ) : (
              <div className="mt-auto bg-gray-900/90 rounded-xl p-6 md:p-8 flex-grow border border-gray-700 shadow-inner flex flex-col">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-800 pb-4">
                  <div className={`w-3 h-3 rounded-full shadow-lg ${isRecording ? 'bg-red-500 animate-pulse shadow-red-500/50' : 'bg-gray-600'}`}></div>
                  <span className="text-sm font-semibold tracking-wide text-gray-400 uppercase">
                    {isRecording ? 'Listening...' : 'Ready for your Answer (Voice or Text)'}
                  </span>
                </div>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Click 'Start Recording' or type your answer manually right here..."
                  className="w-full flex-grow bg-transparent text-gray-200 leading-relaxed text-lg font-medium focus:outline-none resize-none min-h-[80px]"
                />
                {interim && <p className="text-gray-500 italic mix-blend-screen mt-2 border-t border-gray-800 pt-3">{interim}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={isRecording ? handleStopAnswer : handleStartAnswer}
            disabled={isProcessing}
            className={`flex-1 py-5 rounded-2xl font-bold text-lg md:text-xl shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex items-center justify-center gap-3 cursor-pointer transition-all transform hover:-translate-y-1 text-white ${
              isRecording 
                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'
            }`}
          >
            {isProcessing ? 'Processing...' : isRecording ? 'Stop Recording' : 'Start Recording Voice'}
          </button>
          
          <button
            onClick={handleStopAnswer}
            disabled={isProcessing || isRecording || transcript.trim().length === 0}
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 py-5 rounded-2xl font-bold text-lg md:text-xl shadow-[0_4px_20px_rgba(16,185,129,0.2)] flex items-center justify-center gap-3 cursor-pointer transition-all text-white"
          >
            Submit Answer
          </button>
        </div>

        {/* End Interview Manual Trigger */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
             onClick={finishInterview}
             className="w-full py-4 text-gray-400 hover:text-white hover:bg-rose-900/40 rounded-xl transition-all font-semibold uppercase tracking-widest text-sm border border-transparent hover:border-rose-500/30"
          >
             🛑 End Interview & Get Analytical Report
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
