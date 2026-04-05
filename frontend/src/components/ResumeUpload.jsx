import React, { useState, useRef } from 'react';

export default function ResumeUpload({ onStart }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile) => {
    if (selectedFile.type !== 'application/pdf') {
      alert('Please securely upload a PDF file.');
      return;
    }
    setFile(selectedFile);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:8000/api/resume', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 500) {
          throw new Error('500: Backend encountered an error processing this PDF. Ensure it is a valid, readable text-based PDF.');
        }
        throw new Error(`Failed to parse resume (Status: ${res.status})`);
      }

      const data = await res.json();
      onStart(data);
    } catch (err) {
      console.error(err);
      if (err.message.includes('500') || (err.message.includes('Failed') && !err.message.includes('fetch'))) {
        alert(err.message);
      } else {
        alert('Network error: Is the backend running on port 8000? Please wait a few seconds for the backend to start up, or run it manually.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
      <div className="text-center mb-12">
        <h2 className="text-5xl md:text-6xl font-extrabold mb-4 tracking-tight leading-tight">
          Next-Gen <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Technical</span> Screening.
        </h2>
        <p className="text-xl text-gray-400 font-light max-w-xl mx-auto">
          Upload your resume to instantly generate a FAANG-tier dependent architectural scenario interview based exclusively on your capabilities.
        </p>
      </div>

      <div 
        className={`w-full glass-panel rounded-3xl p-10 md:p-14 text-center cursor-pointer transition-all duration-300 transform ${dragActive ? 'scale-[1.02] border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.2)]' : 'hover:scale-[1.01] hover:border-gray-600'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
      >
        <input 
          ref={inputRef}
          type="file" 
          accept=".pdf" 
          onChange={handleFileChange} 
          className="hidden" 
        />
        
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
          <svg className={`w-12 h-12 text-indigo-400 transition-all duration-300 ${dragActive ? 'scale-110' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        
        {file ? (
          <div className="animate-fade-in fade-in">
            <h3 className="text-2xl font-bold text-white mb-2">{file.name}</h3>
            <p className="text-green-400 font-medium text-sm tracking-wide uppercase">PDF Verified • Ready for Parsing</p>
          </div>
        ) : (
          <div>
            <h3 className="text-2xl font-bold text-gray-200 mb-2">Drag & Drop your Resume</h3>
            <p className="text-gray-500">or click to browse files (PDF only)</p>
          </div>
        )}
      </div>

      <button 
        onClick={handleSubmit}
        disabled={!file || isUploading}
        className="mt-10 w-full md:w-auto px-12 py-5 rounded-2xl bg-white text-black font-extrabold text-lg tracking-wide shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
      >
        {isUploading ? (
          <>
            <svg className="animate-spin h-6 w-6 text-black" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generating AI Context...
          </>
        ) : (
          'INITIALIZE INTERVIEW MODULE'
        )}
      </button>
    </div>
  );
}
