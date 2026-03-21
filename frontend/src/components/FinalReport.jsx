import React from 'react';

export default function FinalReport({ sessionData, onRetry }) {
  const { final_score, avg_answer_quality, avg_confidence, proctoring_score, strengths, detailed_answers } = sessionData;

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]';
    if (score >= 6) return 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]';
    return 'text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.5)]';
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center animate-fade-in fade-in pb-12">
      <div className="text-center mb-10">
        <h2 className="text-4xl md:text-5xl font-extrabold mb-3 tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
          Interview Assessment Complete
        </h2>
        <p className="text-gray-400 font-medium tracking-wide">AI-driven analysis across Logic, Confidence, and Integrity.</p>
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="md:col-span-4 glass-panel rounded-3xl p-10 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          <p className="text-sm font-bold text-gray-400 tracking-widest uppercase mb-4">Overall Candidate Rating</p>
          <div className="relative">
            <svg className="w-48 h-48 transform -rotate-90 overflow-visible">
              <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-800" />
              <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={552} strokeDashoffset={552 - (552 * final_score) / 10} className="text-indigo-500 transition-all duration-1000 ease-out drop-shadow-[0_0_15px_rgba(99,102,241,0.8)]" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-6xl font-black ${getScoreColor(final_score)}`}>{final_score}</span>
            </div>
          </div>
        </div>

        {/* Sub Metrics */}
        <div className="glass-panel rounded-3xl p-6 text-center transform hover:-translate-y-2 transition-transform duration-300 border-t-2 border-t-indigo-500/50">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Technical Logic</p>
          <p className={`text-4xl font-extrabold ${getScoreColor(avg_answer_quality)}`}>{avg_answer_quality}<span className="text-lg text-gray-600">/10</span></p>
        </div>
        <div className="glass-panel rounded-3xl p-6 text-center transform hover:-translate-y-2 transition-transform duration-300 border-t-2 border-t-purple-500/50">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Acoustic Confidence</p>
          <p className={`text-4xl font-extrabold ${getScoreColor(avg_confidence)}`}>{avg_confidence}<span className="text-lg text-gray-600">/10</span></p>
        </div>
        <div className="glass-panel rounded-3xl p-6 text-center transform hover:-translate-y-2 transition-transform duration-300 border-t-2 border-t-pink-500/50">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Proctor Integrity</p>
          <p className={`text-4xl font-extrabold ${getScoreColor(proctoring_score)}`}>{proctoring_score}<span className="text-lg text-gray-600">/10</span></p>
        </div>
        <div className="glass-panel rounded-3xl p-6 text-center transform hover:-translate-y-2 transition-transform duration-300 flex flex-col items-center justify-center border-t-2 border-t-blue-500/50">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Primary Domains</p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            {strengths.map(s => <span key={s} className="px-2 py-1 text-[10px] font-bold bg-white/5 text-gray-200 rounded-md uppercase border border-white/10">{s}</span>)}
          </div>
        </div>
      </div>

      <div className="w-full glass-panel rounded-3xl p-8 mb-10">
        <h3 className="text-xl font-bold mb-6 text-white uppercase tracking-wider border-b border-white/10 pb-4">Detailed Question Breakdown</h3>
        <div className="space-y-6">
          {detailed_answers.map((ans, i) => (
            <div key={i} className="bg-black/40 rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <span className="px-3 py-1 bg-white/10 text-gray-300 text-xs font-bold uppercase rounded-md tracking-wider shadow-sm">Response {i + 1}</span>
                <span className={`text-xl font-black ${getScoreColor(ans.semantic_score)}`}>{ans.semantic_score} <span className="text-sm font-medium text-gray-600">Logic Score</span></span>
              </div>
              <p className="text-gray-200 font-medium leading-relaxed mb-4 text-lg">"{ans.transcribed_text}"</p>
              <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-5 flex gap-4 mt-2">
                <span className="text-2xl drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">🤖</span>
                <div>
                  <p className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider mb-1.5">AI Feedback Analysis</p>
                  <p className="text-sm text-indigo-100/90 leading-relaxed font-medium">{ans.semantic_feedback}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onRetry} className="px-12 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-2xl font-extrabold text-lg shadow-[0_4px_30px_rgba(79,70,229,0.5)] hover:shadow-[0_4px_40px_rgba(79,70,229,0.7)] transition-all transform hover:-translate-y-1">
        Begin New Interview Simulation
      </button>
    </div>
  );
}
