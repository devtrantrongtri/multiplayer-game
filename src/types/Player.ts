export interface Player {
  id?: string;
  name: string;
  x: number;
  y: number;
  health: number;
  color: string;
  speed: number;
  score: number;
  level: number;
  xp: number;
  direction: {
    x: number;
    y: number;
  };
}

export interface Item {
  id: string;
  x: number;
  y: number;
  type: 'coin' | 'star' | 'health';
  value: number;
}

export interface DangerZone {
  x: number;
  y: number;
  width: number;
  height: number;
  damage: number;
}
