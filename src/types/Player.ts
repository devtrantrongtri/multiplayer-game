export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  speed: number;
  score: number;
}

export interface Item {
  id: string;
  x: number;
  y: number;
  type: 'coin' | 'star';
  value: number;
}
