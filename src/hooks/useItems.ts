import { useEffect, useState } from 'react';
import { ref, onValue, set, remove, get, update } from 'firebase/database';
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

  const collectItem = async (itemId: string, playerId: string, currentScore: number) => {
    const item = items[itemId];
    if (!item) return;

    const itemType = Object.values(ITEM_TYPES).find(t => t.type === item.type);
    if (!itemType) return;

    try {
      // First, remove the item to prevent double collection
      const itemRef = ref(database, `items/${itemId}`);
      await remove(itemRef);

      // Then update player stats
      const playerRef = ref(database, `players/${playerId}`);
      const playerSnapshot = await get(playerRef);
      const playerData = playerSnapshot.val();
      
      if (!playerData) return;

      const updates: {
        score: number;
        health: number;
        xp: number;
        level?: number;
        speed?: number;
      } = {
        score: currentScore + itemType.value,
        health: itemType.health > 0 ? Math.min(100, playerData.health + itemType.health) : playerData.health,
        xp: playerData.xp + itemType.xp,
      };

      const newLevel = Math.floor(updates.xp / 100) + 1;
      if (newLevel > playerData.level) {
        updates.level = newLevel;
        updates.speed = playerData.speed * 1.1;
        updates.health = 100;
      }

      await update(playerRef, updates);
    } catch (error) {
      console.error('Error collecting item:', error);
    }
  };

  return {
    items,
    collectItem,
  };
};
