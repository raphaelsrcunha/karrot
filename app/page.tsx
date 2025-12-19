'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [roomCode, setRoomCode] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-6xl font-bold text-purple-600 mb-2">🥕</h1>
          <h2 className="text-4xl font-bold text-gray-900">Karrot</h2>
          <p className="mt-2 text-gray-600">Interactive quizzes made simple</p>
        </div>

        {/* Join Room */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div>
            <label htmlFor="roomCode" className="block text-sm font-medium text-gray-700 mb-2">
              Enter room code
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl font-bold tracking-wider uppercase"
              maxLength={6}
            />
          </div>
          <Link
            href={`/join/${roomCode}`}
            className={`block w-full py-3 px-4 rounded-lg font-semibold text-white text-center transition-all ${roomCode.length === 6
                ? 'bg-purple-600 hover:bg-purple-700 hover:shadow-lg'
                : 'bg-gray-300 cursor-not-allowed'
              }`}
            onClick={(e) => {
              if (roomCode.length !== 6) e.preventDefault();
            }}
          >
            Join Quiz
          </Link>
        </div>

        {/* Create Quiz */}
        <div className="text-center">
          <p className="text-gray-600 mb-4">Want to host a quiz?</p>
          <Link
            href="/host"
            className="inline-block px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 font-semibold rounded-lg hover:bg-purple-50 transition-all"
          >
            Create Quiz
          </Link>
        </div>
      </div>
    </div>
  );
}
