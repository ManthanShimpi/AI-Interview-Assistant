import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await axios.post('http://localhost:8000/api/auth/register', {
        username,
        password
      });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl relative overflow-hidden max-w-md w-full mx-auto mt-20">
      <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500"></div>
      <h2 className="text-3xl font-extrabold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Create Account</h2>
      {error && <div className="w-full p-3 mb-4 rounded bg-red-900/50 border border-red-800 text-red-200 text-sm text-center">{error}</div>}
      <form onSubmit={handleSignup} className="w-full flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
          <input
            type="text"
            className="w-full p-3 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all font-mono text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
          <input
            type="password"
            className="w-full p-3 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all font-mono text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="w-full mt-2 py-3 rounded-xl font-bold tracking-wide bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-pink-600/20 active:scale-[0.98]"
        >
          SIGN UP
        </button>
      </form>
      <p className="mt-6 text-sm text-gray-500">
        Already have an account? <Link to="/login" className="text-pink-400 hover:text-pink-300 font-medium pb-0.5 border-b border-pink-400/30 hover:border-pink-300 transition-all">Log in</Link>
      </p>
    </div>
  );
}

export default Signup;
