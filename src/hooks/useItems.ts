import { useEffect, useState } from 'react';
import { ref, onValue, set, remove } from 'firebase/database';
import { database } from '../firebase';
import { Item } from '../types/Player';

const ITEM_SPAWN_INTERVAL = 5000; // 5 seconds
const MAX_ITEMS = 10;
const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;
const GRID_SIZE = 50;

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
      const type = Math.random() > 0.7 ? 'star' : 'coin';
      const newItem: Item = {
        id: Date.now().toString(),
        x: Math.floor(Math.random() * (MAP_WIDTH - GRID_SIZE) / GRID_SIZE) * GRID_SIZE,
        y: Math.floor(Math.random() * (MAP_HEIGHT - GRID_SIZE) / GRID_SIZE) * GRID_SIZE,
        type,
        value: type === 'star' ? 50 : 10,
      };

      set(itemRef, newItem);
    };

    const interval = setInterval(spawnItem, ITEM_SPAWN_INTERVAL);
    return () => clearInterval(interval);
  }, [items]);

  const collectItem = (itemId: string, playerId: string, currentScore: number) => {
    const item = items[itemId];
    if (!item) return;

    // Update player score
    const playerRef = ref(database, `players/${playerId}/score`);
    set(playerRef, currentScore + item.value);

    // Remove collected item
    const itemRef = ref(database, `items/${itemId}`);
    remove(itemRef);
  };

  return {
    items,
    collectItem,
  };
};
