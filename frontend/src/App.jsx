import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import InterviewArea from './components/InterviewArea';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import HistoryDetail from './components/HistoryDetail';

function App() {
  return (
    <Router>
      <div className="min-h-screen text-white relative flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden">
        {/* Ambient Animated Gradients */}
        <div className="fixed top-20 -left-20 w-96 h-96 bg-indigo-600 rounded-full mix-blend-screen filter blur-[100px] opacity-30 animate-float pointer-events-none"></div>
        <div className="fixed top-40 -right-20 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-[100px] opacity-30 animate-float pointer-events-none" style={{ animationDelay: '2s' }}></div>
        <div className="fixed -bottom-32 left-1/3 w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-[100px] opacity-30 animate-float pointer-events-none" style={{ animationDelay: '4s' }}></div>

        <header className="absolute top-0 w-full p-6 md:px-12 flex justify-between items-center z-50">
          <div className="flex items-center gap-4 cursor-pointer group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)] group-hover:shadow-[0_0_30px_rgba(99,102,241,0.7)] group-hover:scale-105 transition-all duration-300">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-500">Auto<span className="text-indigo-400">FAANG</span></h1>
              <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-500/80">AI Recruiter</p>
            </div>
          </div>
        </header>

        <main className="w-full max-w-7xl mx-auto z-10 flex-grow flex flex-col justify-center mt-16 md:mt-24">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/interview" element={<InterviewArea />} />
            <Route path="/history/:id" element={<HistoryDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
        <footer className="w-full text-center p-6 text-gray-600 text-sm mt-auto z-10 font-medium tracking-wide">
          <p>Automated Video Interrogation System • Deep Learning Evaluator</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
