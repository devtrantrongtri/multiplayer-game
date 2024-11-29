import { useEffect, useState } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { database } from '../firebase';
import { Player } from '../types/Player';

const PLAYER_SPEED = 1;
const MAX_HEALTH = 100;
const XP_PER_LEVEL = 100;

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

  const updatePlayerHealth = (health: number) => {
    if (players[playerId]) {
      const playerRef = ref(database, `players/${playerId}`);
      set(playerRef, {
        ...players[playerId],
        health: Math.max(0, Math.min(MAX_HEALTH, health)),
      });
    }
  };

  const addXP = (amount: number) => {
    if (players[playerId]) {
      const player = players[playerId];
      const newXP = player.xp + amount;
      const newLevel = Math.floor(newXP / XP_PER_LEVEL) + 1;
      const levelUp = newLevel > player.level;

      const playerRef = ref(database, `players/${playerId}`);
      set(playerRef, {
        ...player,
        xp: newXP,
        level: newLevel,
        // Tăng tốc độ khi lên cấp
        speed: levelUp ? player.speed * 1.1 : player.speed,
        // Hồi máu khi lên cấp
        health: levelUp ? MAX_HEALTH : player.health,
      });

      return levelUp;
    }
    return false;
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
      score: 0,
      level: 1,
      xp: 0,
      health: MAX_HEALTH,
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
    updatePlayerHealth,
    addXP,
    addPlayer,
    removePlayer,
  };
};
