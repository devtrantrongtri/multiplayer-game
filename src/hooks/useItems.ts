import { useEffect, useState } from 'react';
import { ref, onValue, set, remove } from 'firebase/database';
import { database } from '../firebase';
import { Item } from '../types/Player';

const ITEM_SPAWN_INTERVAL = 5000; // 5 seconds
const MAX_ITEMS = 10;
const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;
const GRID_SIZE = 50;

const ITEM_TYPES = {
  COIN: { type: 'coin' as const, value: 10, xp: 10, health: 0 },
  STAR: { type: 'star' as const, value: 50, xp: 50, health: 0 },
  HEALTH: { type: 'health' as const, value: 0, xp: 20, health: 30 },
};

export const useItems = () => {
  const [items, setItems] = useState<{ [key: string]: Item }>({});

  // Listen to items changes
  useEffect(() => {
    const itemsRef = ref(database, 'items');
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      setItems(data || {});
    });

    return () => unsubscribe();
  }, []);

  // Spawn items periodically
  useEffect(() => {
    const spawnItem = () => {
      if (Object.keys(items).length >= MAX_ITEMS) return;

      const itemRef = ref(database, `items/${Date.now()}`);
      const randomValue = Math.random();
      let itemType;
      
      if (randomValue > 0.9) { // 10% chance for health
        itemType = ITEM_TYPES.HEALTH;
      } else if (randomValue > 0.7) { // 20% chance for star
        itemType = ITEM_TYPES.STAR;
      } else { // 70% chance for coin
        itemType = ITEM_TYPES.COIN;
      }

      const newItem: Item = {
        id: Date.now().toString(),
        x: Math.floor(Math.random() * (MAP_WIDTH - GRID_SIZE) / GRID_SIZE) * GRID_SIZE,
        y: Math.floor(Math.random() * (MAP_HEIGHT - GRID_SIZE) / GRID_SIZE) * GRID_SIZE,
        type: itemType.type,
        value: itemType.value,
      };

      set(itemRef, newItem);
    };

    const interval = setInterval(spawnItem, ITEM_SPAWN_INTERVAL);
    return () => clearInterval(interval);
  }, [items]);

  const collectItem = (itemId: string, playerId: string, currentScore: number) => {
    const item = items[itemId];
    if (!item) return;

    const itemType = Object.values(ITEM_TYPES).find(t => t.type === item.type);
    if (!itemType) return;

    // Update player score and health
    const playerRef = ref(database, `players/${playerId}`);
    const updates: any = {
      score: currentScore + itemType.value,
    };

    // Get current player data for health update
    const playerDataRef = ref(database, `players/${playerId}`);
    onValue(playerDataRef, (snapshot) => {
      const playerData = snapshot.val();
      if (playerData && itemType.health > 0) {
        updates.health = Math.min(100, playerData.health + itemType.health);
      }
      if (playerData && itemType.xp > 0) {
        const newXP = playerData.xp + itemType.xp;
        const newLevel = Math.floor(newXP / 100) + 1;
        const levelUp = newLevel > playerData.level;

        updates.xp = newXP;
        updates.level = newLevel;
        if (levelUp) {
          updates.speed = playerData.speed * 1.1;
          updates.health = 100;
        }
      }
      set(playerRef, { ...playerData, ...updates });
    }, { onlyOnce: true });

    // Remove collected item
    const itemRef = ref(database, `items/${itemId}`);
    remove(itemRef);
  };

  return {
    items,
    collectItem,
  };
};
