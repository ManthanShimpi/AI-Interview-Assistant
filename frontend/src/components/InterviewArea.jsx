import React, { useState } from 'react';
import ResumeUpload from './ResumeUpload';
import InterviewRoom from './InterviewRoom';
import FinalReport from './FinalReport';
import { useNavigate } from 'react-router-dom';

function InterviewArea() {
  const [stage, setStage] = useState('upload'); 
  const [sessionData, setSessionData] = useState(null);
  const navigate = useNavigate();

  const handleStartInterview = (data) => {
    setSessionData(data);
    setStage('interview');
  };

  const handleFinishInterview = (report) => {
    setSessionData(report);
    setStage('report');
  };

  const resetInterview = () => {
    navigate('/');
  };

  return (
    <div className="w-full transition-all duration-700 ease-out fade-in">
      <div className="mb-4">
        <button onClick={resetInterview} className="text-gray-400 hover:text-white text-sm font-medium flex items-center transition-colors">
          ← Back to Dashboard
        </button>
      </div>
      {stage === 'upload' && <ResumeUpload onStart={handleStartInterview} />}
      {stage === 'interview' && <InterviewRoom sessionData={sessionData} onFinish={handleFinishInterview} />}
      {stage === 'report' && <FinalReport sessionData={sessionData} onRetry={resetInterview} />}
    </div>
  );
}

export default InterviewArea;
