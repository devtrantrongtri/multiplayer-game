import { useEffect, useState } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { database } from '../firebase';
import { DangerZone } from '../types/Player';

const ZONE_UPDATE_INTERVAL = 30000; // 30 seconds
const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;
const GRID_SIZE = 50;

export const useDangerZones = () => {
  const [zones, setZones] = useState<DangerZone[]>([]);

  // Listen to danger zones changes
  useEffect(() => {
    const zonesRef = ref(database, 'dangerZones');
    const unsubscribe = onValue(zonesRef, (snapshot) => {
      const data = snapshot.val();
      setZones(data ? Object.values(data) : []);
    });

    return () => unsubscribe();
  }, []);

  // Update danger zones periodically
  useEffect(() => {
    const updateZones = () => {
      const zonesRef = ref(database, 'dangerZones');
      const newZones: DangerZone[] = [];

      // Create 2-3 random danger zones
      const numZones = Math.floor(Math.random() * 2) + 2;
      for (let i = 0; i < numZones; i++) {
        const width = Math.floor(Math.random() * 300) + 200; // 200-500px
        const height = Math.floor(Math.random() * 300) + 200;
        newZones.push({
          x: Math.floor(Math.random() * (MAP_WIDTH - width) / GRID_SIZE) * GRID_SIZE,
          y: Math.floor(Math.random() * (MAP_HEIGHT - height) / GRID_SIZE) * GRID_SIZE,
          width,
          height,
          damage: Math.floor(Math.random() * 5) + 5, // 5-10 damage per second
        });
      }

      set(zonesRef, newZones);
    };

    updateZones(); // Initial zones
    const interval = setInterval(updateZones, ZONE_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Check if a point is in any danger zone
  const isInDangerZone = (x: number, y: number): DangerZone | null => {
    for (const zone of zones) {
      if (
        x >= zone.x && 
        x <= zone.x + zone.width && 
        y >= zone.y && 
        y <= zone.y + zone.height
      ) {
        return zone;
      }
    }
    return null;
  };

  return {
    zones,
    isInDangerZone,
  };
};
