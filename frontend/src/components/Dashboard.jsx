import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Dashboard() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    axios.get('http://localhost:8000/api/history', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      setHistory(res.data);
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
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="w-full flex justify-center mt-10 z-10 transition-all duration-700 ease-out fade-in">
      <div className="w-full mt-8 max-w-4xl bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 left-0"></div>
        
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Your Dashboard</h2>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/interview')}
              className="px-6 py-2.5 rounded-xl font-bold tracking-wide bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] text-sm"
            >
              + NEW INTERVIEW
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2.5 rounded-xl font-bold tracking-wide bg-gray-800 hover:bg-gray-700 text-gray-300 transition-all border border-gray-700 text-sm"
            >
              LOGOUT
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/40 rounded-2xl border border-gray-800/50">
            <div className="text-gray-500 mb-4 text-xl">No interviews taken yet.</div>
            <p className="text-sm text-gray-600">Start your first AI interview to begin tracking your performance.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.map((item) => (
              <div 
                key={item.id} 
                onClick={() => navigate(`/history/${item.id}`)}
                className="bg-gray-800/60 hover:bg-gray-800 p-5 rounded-2xl cursor-pointer border border-gray-700/50 hover:border-indigo-500/50 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all -mr-10 -mt-10"></div>
                <div className="flex justify-between items-start mb-2 relative z-10">
                  <div className="text-lg font-bold text-gray-200">Session #{item.id}</div>
                  <div className={`px-2 py-1 text-xs rounded-lg font-bold \${
                    item.final_score >= 8 ? 'bg-green-900/50 text-green-400 border border-green-800' :
                    item.final_score >= 5 ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800' :
                    'bg-red-900/50 text-red-400 border border-red-800'
                  }`}>
                    {item.final_score.toFixed(1)}/10
                  </div>
                </div>
                <div className="text-xs text-gray-500 mb-4 relative z-10">
                  {new Date(item.created_at).toLocaleString()}
                </div>
                
                <div className="flex gap-2 text-xs relative z-10">
                  <span className="bg-gray-900/80 text-gray-300 px-2 py-1 rounded">Ans: {item.avg_answer_quality.toFixed(1)}</span>
                  <span className="bg-gray-900/80 text-gray-300 px-2 py-1 rounded">Conf: {item.avg_confidence.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
