export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  score: number;
  speed: number;
  health: number;
  level: number;
  xp: number;
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
