let voicesCache = [];

function loadVoices() {
  voicesCache = window.speechSynthesis.getVoices();
}

// Prefetch voices if available, since some browsers load them asynchronously
if ('speechSynthesis' in window) {
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

export function speakText(text, onEnd) {
  if (!('speechSynthesis' in window)) {
    console.error('Speech synthesis not supported');
    if (onEnd) onEnd();
    return;
  }
  
  // Cancel ongoing speech
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Ensure we have voices
  if (voicesCache.length === 0) {
    loadVoices();
  }
  
  // Find a more natural sounding voice (e.g. Google's cloud voices or Microsoft's Neural voices)
  const preferredVoice = voicesCache.find(v => 
    v.name.includes('Google US English') || 
    v.name.includes('Google UK English Female') ||
    v.name.includes('Microsoft Aria Online') ||
    v.name.includes('Microsoft Guy Online') ||
    v.name.includes('Natural')
  );
  
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  
  if (onEnd) {
    utterance.onend = onEnd;
  }
  
  window.speechSynthesis.speak(utterance);
}

export function startSpeechRecognition(onResult, onEnd, onError) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (onError) onError('Speech recognition not supported in this browser. Please use Chrome/Edge.');
    return null;
  }
  
  // Create instance
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  
  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    
    if (onResult) onResult(finalTranscript, interimTranscript);
  };
  
  recognition.onerror = (event) => {
    console.error('Recognition error:', event.error);
    if (onError) onError(event.error);
  };
  
  recognition.onend = () => {
    if (onEnd) onEnd();
  };
  
  try {
    recognition.start();
  } catch (e) {
    console.error(e);
  }
  
  return recognition;
}
