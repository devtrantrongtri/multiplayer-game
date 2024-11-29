// src/App.tsx
import React, { useState } from 'react';
import { LoginForm } from './components/LoginForm';
import GameMap from './components/GameMap';

function App() {
  const [playerName, setPlayerName] = useState<string | null>(null);

  const handleLogin = (name: string) => {
    setPlayerName(name);
  };

  if (!playerName) {
    return <LoginForm onSubmit={handleLogin} />;
  }

  return <GameMap playerName={playerName} />;
}

export default App;
