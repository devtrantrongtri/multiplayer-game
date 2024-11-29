import { useEffect, useState } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { database } from '../firebase';
import { Player } from '../types/Player';

const PLAYER_SPEED = 1; // Giảm tốc độ xuống 1

export const useGameState = (playerId: string) => {
  const [players, setPlayers] = useState<{ [key: string]: Player }>({});

  useEffect(() => {
    const playersRef = ref(database, 'players');
    
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPlayers(data);
      }
    });

    return () => unsubscribe();
  }, []);

  const updatePlayerPosition = (x: number, y: number) => {
    if (players[playerId]) {
      const playerRef = ref(database, `players/${playerId}`);
      set(playerRef, {
        ...players[playerId],
        x,
        y,
      });
    }
  };

  const addPlayer = (name: string) => {
    const playerRef = ref(database, `players/${playerId}`);
    const newPlayer: Player = {
      id: playerId,
      name,
      x: Math.random() * (window.innerWidth - 50),
      y: Math.random() * (window.innerHeight - 50),
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
      speed: PLAYER_SPEED,
      score: 0, // Thêm điểm số mặc định
    };
    
    set(playerRef, newPlayer);
  };

  const removePlayer = () => {
    const playerRef = ref(database, `players/${playerId}`);
    set(playerRef, null);
  };

  return {
    players,
    updatePlayerPosition,
    addPlayer,
    removePlayer,
  };
};
