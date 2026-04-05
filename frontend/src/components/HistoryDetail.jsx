import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import FinalReport from './FinalReport';

function HistoryDetail() {
  const { id } = useParams();
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    axios.get(`http://localhost:8000/api/history/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      setSessionData(res.data);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
      setLoading(false);
    });
  }, [id, navigate]);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading details...</div>;
  if (!sessionData) return <div className="text-center py-12 text-red-400">Interview not found.</div>;

  return (
    <div className="w-full transition-all duration-700 ease-out fade-in">
      <div className="mb-4">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm font-medium flex items-center transition-colors">
          ← Back to Dashboard
        </button>
      </div>
      <FinalReport sessionData={sessionData} onRetry={() => navigate('/')} isHistory={true}/>
    </div>
  );
}

export default HistoryDetail;
