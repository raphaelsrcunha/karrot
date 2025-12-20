'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [roomCode, setRoomCode] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-12">
        {/* Logo & Title */}
        <div className="text-center space-y-3">
          <div className="text-6xl mb-4">🥕</div>
          <h1 className="text-5xl font-semibold text-gray-900 tracking-tight">my karrot</h1>
          <p className="text-lg text-gray-500 font-light">Interactive presentations made simple</p>
        </div>

        {/* Join Room Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-gray-100 p-10 space-y-6">
          <div className="space-y-3">
            <label htmlFor="roomCode" className="block text-sm font-medium text-gray-600 tracking-wide">
              ENTER CODE
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="000 000"
              className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl text-center text-3xl font-light tracking-[0.5em] uppercase text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
              maxLength={6}
            />
          </div>
          <Link
            href={`/join/${roomCode}`}
            className={`block w-full py-4 px-6 rounded-2xl font-medium text-center transition-all ${roomCode.length === 6
              ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm hover:shadow-md'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            onClick={(e) => {
              if (roomCode.length !== 6) e.preventDefault();
            }}
          >
            Join
          </Link>
        </div>

        {/* Create Quiz */}
        <div className="text-center space-y-4">
          <p className="text-sm text-gray-500 font-light">Want to create a presentation?</p>
          <Link
            href="/host"
            className="inline-flex items-center px-10 py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-2xl transition-all shadow-md hover:shadow-xl hover:-translate-y-1 active:scale-95"
          >
            Create presentation
          </Link>
        </div>
      </div>
    </div>
  );
}
