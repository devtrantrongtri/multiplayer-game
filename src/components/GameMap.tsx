import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { ref, onValue, set, remove, update } from 'firebase/database';
import { db } from '../firebase';
import Auth from './Auth';
import ReactNipple from 'react-nipple';
import 'react-nipple/lib/styles.css';
import { Player as PlayerType, Item as ItemType } from '../types/Player';
import { useItems } from '../hooks/useItems';
import { useDangerZones } from '../hooks/useDangerZones';
import Leaderboard from './Leaderboard';

import enterGameSound from '../audios/enter_game.mp3';
import deathSound from '../audios/adventures-loop-music-226836.mp3';
import fastMoveSound from '../audios/woosh-230554.mp3';
import collectItemSound from '../audios/power-up-type-1-230548.mp3';

const GRID_SIZE = 40; // Smaller grid size for mobile
const MAP_WIDTH = 2000; // Chiều rộng map tổng
const MAP_HEIGHT = 2000; // Chiều cao map tổng
const PLAYER_SPEED = 2; // Giảm tốc độ xuống 1
const COLLECT_DISTANCE = 30; // Khoảng cách để thu thập vật phẩm
const BASE_BOOST_MULTIPLIER = 4; // Tốc độ tăng tốc mặc định (2x)
const MAX_BOOST_MULTIPLIER = 6; // Tốc độ tăng tốc tối đa (3.5x)
const BOOST_INCREMENT = 0.3; // Tốc độ tăng mỗi giây (30%)
const BULLET_COST = 3;
const JOYSTICK_SIZE = 100;

const KEYS = {
  UP: ['ArrowUp', 'w', 'W'],
  DOWN: ['ArrowDown', 's', 'S'],
  LEFT: ['ArrowLeft', 'a', 'A'],
  RIGHT: ['ArrowRight', 'd', 'D'],
  BOOST: [' '] // Space key
};

interface Bullet {
  id: string;
  x: number;
  y: number;
  direction: { x: number; y: number };
  playerId: string;
}

const BULLET_SPEED = 8; // Faster bullets
const BULLET_DAMAGE = 10;
const BULLET_POINTS = 3;
const BULLET_SIZE = 8; // Smaller bullets

interface Trail {
  id: number;
  x: number;
  y: number;
  opacity: number;
  color: string;
}

const getPlayerTransform = (dx: number, dy: number, isBoost: boolean) => {
  if (!dx && !dy) return 0;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return angle;
};

const getPlayerStretch = (dx: number, dy: number, isBoost: boolean) => {
  if (!dx && !dy) return 1;
  const stretch = isBoost ? 1.3 : 1.1;
  return stretch;
};

const ViewPort = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #f0f0f0;
`;

const MapContainer = styled.div<{ x: number; y: number }>`
  position: absolute;
  width: ${MAP_WIDTH}px;
  height: ${MAP_HEIGHT}px;
  left: ${props => -props.x}px;
  top: ${props => -props.y}px;
  background-color: #f0f0f0;
  overflow: hidden;
  transition: all 0.1s linear;
`;

const MapBackground = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  background-image: 
    linear-gradient(to right, #ddd 1px, transparent 1px),
    linear-gradient(to bottom, #ddd 1px, transparent 1px);
  background-size: ${GRID_SIZE}px ${GRID_SIZE}px;
  opacity: 0.1;
`;

const GridOverlay = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  background-image: 
    linear-gradient(to right, #ddd 1px, transparent 1px),
    linear-gradient(to bottom, #ddd 1px, transparent 1px);
  background-size: ${GRID_SIZE}px ${GRID_SIZE}px;
  opacity: 0.1;
  pointer-events: none;
`;

const MotionTrail = styled.div<{ x: number; y: number; color: string; opacity: number; scale: number }>`
  position: absolute;
  width: ${GRID_SIZE}px;
  height: ${GRID_SIZE}px;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  background-color: ${props => props.color};
  opacity: ${props => props.opacity};
  border-radius: 8px;
  transform: scale(${props => props.scale});
  transition: all 0.15s linear;
  pointer-events: none;
  filter: blur(1px);
`;

const BulletElement = styled.div<{ x: number; y: number }>`
  position: absolute;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  width: ${BULLET_SIZE}px;
  height: ${BULLET_SIZE}px;
  background: #ff4444;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
`;

const ButtonContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 40px;
  z-index: 1000;
`;

const ShootButton = styled.button`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #ff4444;
  color: white;
  border: none;
  font-size: 20px;
  cursor: pointer;
  touch-action: manipulation;
  
  &:active {
    transform: scale(0.95);
  }
`;

const BoostButton = styled.button<{ isBoost: boolean }>`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: ${props => props.isBoost ? 'rgba(255, 99, 71, 0.8)' : 'rgba(0, 0, 0, 0.6)'};
  border: 2px solid ${props => props.isBoost ? '#ff6347' : '#ffffff'};
  color: white;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  touch-action: manipulation;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  
  &:active {
    transform: scale(0.95);
  }
`;

const HealthBar = styled.div<{ health: number }>`
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 4px;
  background: #444;
  border-radius: 2px;
  overflow: hidden;

  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: ${props => props.health}%;
    height: 100%;
    background: ${props => props.health > 50 ? '#4CAF50' : props.health > 20 ? '#FFA000' : '#f44336'};
  }
`;

const Gun = styled.div<{ rotation: number }>`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 6px;
  background: #666;
  border-radius: 3px;
  transform-origin: left center;
  transform: translateY(-50%) rotate(${props => props.rotation}deg);
`;

const PlayerSquare = styled.div<{ x: number; y: number; color: string; transform: number; scale: number; opacity: number }>`
  position: absolute;
  width: ${GRID_SIZE}px;
  height: ${GRID_SIZE}px;
  background-color: ${props => props.color};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  transition: all 0.1s linear;
  transform: translate(${props => -GRID_SIZE/2}px, ${props => -GRID_SIZE/2}px) 
             rotate(${props => props.transform}deg) 
             scale(${props => props.scale});
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  opacity: ${props => props.opacity};
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const PlayerName = styled.div<{ isCurrentPlayer: boolean }>`
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  color: ${props => props.isCurrentPlayer ? '#000000' : '#333333'};
  font-weight: ${props => props.isCurrentPlayer ? 'bold' : 'normal'};
  font-size: 14px;
  text-shadow: 0 0 4px rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.8);
  z-index: 11;
`;

const Trail = styled.div<{ x: number; y: number; opacity: number; color: string }>`
  position: absolute;
  width: ${GRID_SIZE}px;
  height: ${GRID_SIZE}px;
  background-color: ${props => props.color};
  opacity: ${props => props.opacity * 0.5}; 
  border-radius: 50%;
  transform: translate(${-GRID_SIZE/2}px, ${-GRID_SIZE/2}px);
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  pointer-events: none;
  z-index: 5; 
  filter: blur(2px); 
`;

const ItemSquare = styled.div<{ x: number; y: number; type: 'coin' | 'star' | 'health' }>`
  position: absolute;
  width: 20px;
  height: 20px;
  left: ${props => props.x + 15}px;
  top: ${props => props.y + 15}px;
  background-color: ${props => {
    switch (props.type) {
      case 'star':
        return '#ffd700';
      case 'coin':
        return '#ffb900';
      case 'health':
        return '#ff4081';
      default:
        return '#ffffff';
    }
  }};
  border-radius: ${props => props.type === 'star' ? '5px' : '50%'};
  transform: ${props => props.type === 'star' ? 'rotate(45deg)' : 'none'};
  transition: all 0.1s linear;
  z-index: 1;
  box-shadow: 0 0 10px ${props => {
    switch (props.type) {
      case 'star':
        return '#ffd700';
      case 'coin':
        return '#ffb900';
      case 'health':
        return '#ff4081';
      default:
        return '#ffffff';
    }
  }};
`;

const DangerZone = styled.div<{ x: number; y: number; width: number; height: number }>`
  position: absolute;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  width: ${props => props.width}px;
  height: ${props => props.height}px;
  background-color: rgba(255, 0, 0, 0.2);
  border: 2px solid rgba(255, 0, 0, 0.5);
  z-index: 1;
`;

const PlayerInfo = styled.div`
  position: fixed;
  top: 10px;
  left: 10px;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  border-radius: 8px;
  z-index: 1000;
`;

const XPBar = styled.div<{ progress: number }>`
  width: 100px;
  height: 5px;
  background-color: #333;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 5px;

  &::after {
    content: '';
    display: block;
    width: ${props => props.progress}%;
    height: 100%;
    background-color: #2196F3;
    transition: all 0.3s ease;
  }
`;

const JoystickContainer = styled.div`
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: ${JOYSTICK_SIZE}px;
  height: ${JOYSTICK_SIZE}px;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  touch-action: none;
  z-index: 1000;
`;

const JoystickKnob = styled.div<{ x: number; y: number }>`
  position: absolute;
  width: ${JOYSTICK_SIZE * 0.4}px;
  height: ${JOYSTICK_SIZE * 0.4}px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  touch-action: none;
`;

const Dialog = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  z-index: 100;
`;

const DialogMessage = styled.p`
  margin: 0;
`;

const DialogButton = styled.button`
  margin-top: 10px;
  padding: 10px 20px;
  background: linear-gradient(to bottom, #4CAF50, #45a049);
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(1px);
  }
`;

const DialogOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(3px);
`;

const DialogContent = styled.div`
  background: linear-gradient(to bottom, #2c3e50, #1a2634);
  padding: 2.5rem;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: slideIn 0.3s ease-out;

  @keyframes slideIn {
    from {
      transform: translateY(-20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

const DialogTitle = styled.h2`
  margin: 0 0 1.5rem;
  color: #fff;
  font-size: 2.2rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  font-weight: bold;
`;

const DialogStats = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
`;

const StatItem = styled.div`
  color: #fff;
  text-align: center;
  
  .label {
    font-size: 0.9rem;
    color: #8c9cad;
    margin-bottom: 0.3rem;
  }
  
  .value {
    font-size: 1.4rem;
    font-weight: bold;
    color: #4CAF50;
  }
`;

const LogoutButton = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 0.8rem 1.5rem;
  background: rgba(255, 87, 87, 0.9);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  z-index: 1000;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 87, 87, 1);
    transform: translateY(-2px);
  }
`;

const GameMap: React.FC = () => {
  const [showWelcome, setShowWelcome] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);
  const [players, setPlayers] = useState<{ [key: string]: PlayerType }>({});
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0 });
  const [pressedKeys, setPressedKeys] = useState(new Set<string>());
  const [isBoost, setIsBoost] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [moveDirection, setMoveDirection] = useState({ x: 0, y: 0 });
  const [boostLevel, setBoostLevel] = useState(BASE_BOOST_MULTIPLIER);
  const [collectedItems, setCollectedItems] = useState<Set<string>>(new Set());
  const [trails, setTrails] = useState<Trail[]>([]);
  const lastTrailTime = useRef(0);
  const TRAIL_LIFETIME = 150; // Trail lifetime in milliseconds
  const TRAIL_INTERVAL = 30; // Create a trail every 30ms
  const viewportRef = useRef<HTMLDivElement>(null);
  const enterGameSoundRef = useRef<HTMLAudioElement | null>(null);
  const deathSoundRef = useRef<HTMLAudioElement | null>(null);
  const fastMoveSoundRef = useRef<HTMLAudioElement | null>(null);
  const collectItemSoundRef = useRef<HTMLAudioElement | null>(null);
  const { items, collectItem } = useItems();
  const { zones, isInDangerZone } = useDangerZones();
  const joystickRef = useRef<HTMLDivElement>(null);
  const [joystickPos, setJoystickPos] = useState({ x: JOYSTICK_SIZE / 2, y: JOYSTICK_SIZE / 2 });

  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [lastShootTime, setLastShootTime] = useState(0);
  const SHOOT_COOLDOWN = 200; // Cooldown between shots in milliseconds

  const [showStartDialog, setShowStartDialog] = useState(true);
  const [showEndDialog, setShowEndDialog] = useState(false);

  useEffect(() => {
    const playersRef = ref(db, 'players');
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const data = snapshot.val() || {};
      setPlayers(data);
    });

    return () => {
      unsubscribe();
      if (currentPlayer) {
        const playerRef = ref(db, `players/${currentPlayer}`);
        remove(playerRef);
      }
    };
  }, [currentPlayer]);

  const handleNameSubmit = (name: string) => {
    const playerId = name;
    setCurrentPlayer(playerId);

    const newPlayer: PlayerType = {
      id: playerId,
      name,
      x: Math.random() * (MAP_WIDTH - 100) + 50,
      y: Math.random() * (MAP_HEIGHT - 100) + 50,
      health: 100,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      speed: PLAYER_SPEED,
      score: 0,
      level: 1,
      xp: 0,
      direction: { x: 0, y: 0 },
    };

    const playerRef = ref(db, `players/${playerId}`);
    set(playerRef, newPlayer);
    setShowWelcome(false);
  };

  // Keyboard movement
  useEffect(() => {
    if (!currentPlayer || !players[currentPlayer] || pressedKeys.size === 0) {
      setIsMoving(false);
      setMoveDirection({ x: 0, y: 0 });
      return;
    }

    const moveInterval = setInterval(() => {
      const player = players[currentPlayer];
      const baseSpeed = (player.speed || PLAYER_SPEED) * (GRID_SIZE / 10);
      const currentSpeed = baseSpeed * (isBoost ? boostLevel : 1);
      
      let deltaX = 0;
      let deltaY = 0;

      if (pressedKeys.has('UP')) deltaY -= 1;
      if (pressedKeys.has('DOWN')) deltaY += 1;
      if (pressedKeys.has('LEFT')) deltaX -= 1;
      if (pressedKeys.has('RIGHT')) deltaX += 1;

      // Normalize diagonal movement
      if (deltaX !== 0 && deltaY !== 0) {
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        deltaX = deltaX / length;
        deltaY = deltaY / length;
      }

      // Apply speed
      deltaX *= currentSpeed;
      deltaY *= currentSpeed;

      if (deltaX !== 0 || deltaY !== 0) {
        setIsMoving(true);
        setMoveDirection({ x: deltaX, y: deltaY });

        const newX = Math.max(0, Math.min(MAP_WIDTH - GRID_SIZE, player.x + deltaX));
        const newY = Math.max(0, Math.min(MAP_HEIGHT - GRID_SIZE, player.y + deltaY));

        const playerRef = ref(db, `players/${currentPlayer}`);
        update(playerRef, {
          x: newX,
          y: newY,
          direction: { x: deltaX, y: deltaY }
        });
      }
    }, 16);

    return () => clearInterval(moveInterval);
  }, [players, currentPlayer, pressedKeys, isBoost, boostLevel]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setPressedKeys(prev => {
        const newKeys = new Set(prev);
        if (KEYS.UP.includes(e.key)) newKeys.add('UP');
        if (KEYS.DOWN.includes(e.key)) newKeys.add('DOWN');
        if (KEYS.LEFT.includes(e.key)) newKeys.add('LEFT');
        if (KEYS.RIGHT.includes(e.key)) newKeys.add('RIGHT');
        if (KEYS.BOOST.includes(e.key)) setIsBoost(true);
        if (e.key.toLowerCase() === 'b') {
          shoot();
        }
        return newKeys;
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setPressedKeys(prev => {
        const newKeys = new Set(prev);
        if (KEYS.UP.includes(e.key)) newKeys.delete('UP');
        if (KEYS.DOWN.includes(e.key)) newKeys.delete('DOWN');
        if (KEYS.LEFT.includes(e.key)) newKeys.delete('LEFT');
        if (KEYS.RIGHT.includes(e.key)) newKeys.delete('RIGHT');
        if (KEYS.BOOST.includes(e.key)) setIsBoost(false);
        return newKeys;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentPlayer, players, lastShootTime]);

  useEffect(() => {
    if (enterGameSoundRef.current) {
      enterGameSoundRef.current.play();
    }
  }, []);

  useEffect(() => {
    if (currentPlayer && players[currentPlayer]?.health <= 0 && deathSoundRef.current) {
      deathSoundRef.current.play();
    }
  }, [players, currentPlayer]);

  useEffect(() => {
    if (isBoost && fastMoveSoundRef.current) {
      fastMoveSoundRef.current.play();
    }
  }, [isBoost]);

  useEffect(() => {
    if (collectItemSoundRef.current) {
      collectItemSoundRef.current.play();
    }
  }, [collectedItems]);

  const createTrail = (currentPlayer: PlayerType) => {
    const currentTime = Date.now();
    
    if (currentTime - lastTrailTime.current >= TRAIL_INTERVAL) {
      lastTrailTime.current = currentTime;
      
      setTrails(prevTrails => [
        ...prevTrails.slice(-10), // Keep a maximum of 10 trails
        {
          id: currentTime,
          x: currentPlayer.x,
          y: currentPlayer.y,
          opacity: isBoost ? 0.4 : 0.2,
          color: currentPlayer.color
        }
      ]);

      // Automatically remove trails after a certain time
      setTimeout(() => {
        setTrails(prevTrails => prevTrails.filter(t => t.id !== currentTime));
      }, TRAIL_LIFETIME);
    }
  };

  // Update trails during movement
  useEffect(() => {
    if (!currentPlayer || !players[currentPlayer] || !isMoving) return;
    createTrail(players[currentPlayer]);
  }, [players, currentPlayer, isMoving, isBoost]);

  // Item collection
  useEffect(() => {
    if (!currentPlayer || !players[currentPlayer]) return;

    const player = players[currentPlayer];
    Object.values(items).forEach(item => {
      const dx = player.x - item.x;
      const dy = player.y - item.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < COLLECT_DISTANCE && !collectedItems.has(item.id)) {
        setCollectedItems(prev => new Set(prev).add(item.id));
        collectItem(item.id, currentPlayer, player.score || 0);
      }
    });
  }, [players, currentPlayer, items, collectItem, collectedItems]);

  // Camera follow
  useEffect(() => {
    if (currentPlayer && players[currentPlayer] && viewportRef.current) {
      const player = players[currentPlayer];
      const viewport = viewportRef.current;
      const viewportWidth = viewport.clientWidth;
      const viewportHeight = viewport.clientHeight;

      const targetX = player.x - viewportWidth / 2;
      const targetY = player.y - viewportHeight / 2;

      const newX = Math.max(0, Math.min(MAP_WIDTH - viewportWidth, targetX));
      const newY = Math.max(0, Math.min(MAP_HEIGHT - viewportHeight, targetY));

      setCameraPosition({ x: newX, y: newY });
    }
  }, [players, currentPlayer]);

  const shoot = () => {
    if (!currentPlayer || !players[currentPlayer]) return;
    
    const now = Date.now();
    if (now - lastShootTime < SHOOT_COOLDOWN) return;
    
    const player = players[currentPlayer];
    
    // Check if player has enough score to shoot
    if ((player.score || 0) < BULLET_COST) return;
    
    setLastShootTime(now);
    
    const bulletId = `bullet-${currentPlayer}-${now}`;
    const direction = player.direction || { x: 1, y: 0 };
    
    // Normalize direction
    const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    const normalizedDirection = {
      x: direction.x / (magnitude || 1),
      y: direction.y / (magnitude || 1)
    };

    const newBullet: Bullet = {
      id: bulletId,
      x: player.x,
      y: player.y,
      direction: normalizedDirection,
      playerId: currentPlayer
    };

    // Deduct score for shooting
    const playerRef = ref(db, `players/${currentPlayer}`);
    update(playerRef, {
      score: (player.score || 0) - BULLET_COST
    });

    setBullets(prev => [...prev, newBullet]);
  };

  useEffect(() => {
    const bulletInterval = setInterval(() => {
      setBullets(prevBullets => {
        let updatedBullets = prevBullets.map(bullet => ({
          ...bullet,
          x: bullet.x + bullet.direction.x * BULLET_SPEED,
          y: bullet.y + bullet.direction.y * BULLET_SPEED
        }));

        // Check for collisions with players
        updatedBullets = updatedBullets.filter(bullet => {
          let bulletShouldExist = true;

          Object.entries(players).forEach(([playerId, player]) => {
            if (!player || playerId === bullet.playerId) return;

            const dx = bullet.x - player.x;
            const dy = bullet.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < GRID_SIZE / 2) {
              // Hit detected
              const playerRef = ref(db, `players/${playerId}`);
              const shooterRef = ref(db, `players/${bullet.playerId}`);

              // Update player health
              update(playerRef, {
                health: (player.health || 100) - BULLET_DAMAGE
              });

              // Update shooter's score
              if (players[bullet.playerId]) {
                update(shooterRef, {
                  score: (players[bullet.playerId].score || 0) + BULLET_POINTS
                });
              }

              bulletShouldExist = false;
            }
          });

          return bulletShouldExist;
        });

        // Remove bullets that are out of bounds
        return updatedBullets.filter(bullet => 
          bullet.x >= 0 && bullet.x <= MAP_WIDTH &&
          bullet.y >= 0 && bullet.y <= MAP_HEIGHT
        );
      });
    }, 16);

    return () => clearInterval(bulletInterval);
  }, [players]);

  const handleStartGame = () => {
    setShowStartDialog(false);
  };

  const handleEndGame = () => {
    // Logic to reset or end the game
  };

  const handleJoystickStart = (e: React.TouchEvent | React.MouseEvent) => {
    const touch = 'touches' in e ? e.touches[0] : e;
    const rect = joystickRef.current?.getBoundingClientRect();
    if (rect) {
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      updateJoystickPosition(x, y);
    }
  };

  const handleJoystickMove = (e: React.TouchEvent | React.MouseEvent) => {
    const touch = 'touches' in e ? e.touches[0] : e;
    const rect = joystickRef.current?.getBoundingClientRect();
    if (rect && ('touches' in e ? e.touches.length > 0 : true)) {
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      updateJoystickPosition(x, y);
    }
  };

  const handleJoystickEnd = () => {
    setJoystickPos({ x: JOYSTICK_SIZE / 2, y: JOYSTICK_SIZE / 2 });
    setMoveDirection({ x: 0, y: 0 });
  };

  const updateJoystickPosition = (x: number, y: number) => {
    const centerX = JOYSTICK_SIZE / 2;
    const centerY = JOYSTICK_SIZE / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = JOYSTICK_SIZE / 2;
    
    let newX = x;
    let newY = y;
    
    if (distance > maxDistance) {
      const angle = Math.atan2(dy, dx);
      newX = centerX + Math.cos(angle) * maxDistance;
      newY = centerY + Math.sin(angle) * maxDistance;
    }
    
    setJoystickPos({ x: newX, y: newY });
    setMoveDirection({
      x: (newX - centerX) / maxDistance,
      y: (newY - centerY) / maxDistance
    });
  };

  useEffect(() => {
    if (currentPlayer && players[currentPlayer]) {
      const interval = setInterval(() => {
        const dx = moveDirection.x;
        const dy = moveDirection.y;
        
        if (dx !== 0 || dy !== 0) {
          const speed = isBoost ? PLAYER_SPEED * 2 : PLAYER_SPEED;
          const newX = players[currentPlayer].x + dx * speed;
          const newY = players[currentPlayer].y + dy * speed;
          
          // Update player position
          const playerRef = ref(db, `players/${currentPlayer}`);
          update(playerRef, {
            x: Math.max(0, Math.min(MAP_WIDTH, newX)),
            y: Math.max(0, Math.min(MAP_HEIGHT, newY)),
            direction: { x: dx, y: dy }
          });
          
          // Add trail
          if (isBoost) {
            createTrail(players[currentPlayer]);
          }
        }
      }, 16);
      
      return () => clearInterval(interval);
    }
  }, [currentPlayer, players, moveDirection, isBoost]);

  if (showWelcome || !currentPlayer) {
    return <Auth onLogin={handleNameSubmit} />;
  }

  if (showStartDialog) {
    return (
      <DialogOverlay>
        <DialogContent>
          <DialogTitle>Welcome to the Game!</DialogTitle>
          <DialogMessage>Get ready to start your adventure!</DialogMessage>
          <DialogButton onClick={handleStartGame}>Start</DialogButton>
        </DialogContent>
      </DialogOverlay>
    );
  }

  if (showEndDialog) {
    return (
      <DialogOverlay>
        <DialogContent>
          <DialogTitle>Game Over!</DialogTitle>
          <DialogMessage>Better luck next time!</DialogMessage>
          <DialogButton onClick={handleEndGame}>Restart</DialogButton>
        </DialogContent>
      </DialogOverlay>
    );
  }

  return (
    <ViewPort ref={viewportRef}>
      <audio ref={enterGameSoundRef} src={enterGameSound} preload="auto" />
      <audio ref={deathSoundRef} src={deathSound} preload="auto" />
      <audio ref={fastMoveSoundRef} src={fastMoveSound} preload="auto" />
      <audio ref={collectItemSoundRef} src={collectItemSound} preload="auto" />
      <MapContainer x={cameraPosition.x} y={cameraPosition.y}>
        <MapBackground />
        <GridOverlay />
        
        {/* Trails */}
        {trails.map((trail) => (
          <Trail 
            key={trail.id}
            x={trail.x}
            y={trail.y}
            opacity={trail.opacity}
            color={trail.color}
          />
        ))}

        {/* Bullets */}
        {bullets.map(bullet => (
          <BulletElement
            key={bullet.id}
            x={bullet.x}
            y={bullet.y}
          />
        ))}

        {/* Items */}
        {Object.values(items).map((item) => (
          <ItemSquare
            key={item.id}
            x={item.x}
            y={item.y}
            type={item.type}
          />
        ))}

        {/* Players */}
        {Object.entries(players).map(([id, player]) => (
          <PlayerSquare
            key={id}
            x={player.x}
            y={player.y}
            color={player.color}
            transform={getPlayerTransform(
              player.direction?.x || 0,
              player.direction?.y || 0,
              isBoost && id === currentPlayer
            )}
            scale={isBoost && id === currentPlayer ? 0.8 : 1}
            opacity={1}
          >
            <HealthBar health={player.health || 100} />
            <Gun rotation={getPlayerTransform(
              player.direction?.x || 0,
              player.direction?.y || 0,
              false
            )} />
            <PlayerName isCurrentPlayer={id === currentPlayer}>{player.name}</PlayerName>
          </PlayerSquare>
        ))}

        <Leaderboard players={players} currentPlayerId={currentPlayer} />
      </MapContainer>

      {/* Controls */}
      <ButtonContainer>
        <BoostButton
          isBoost={isBoost}
          onMouseDown={() => setIsBoost(true)}
          onTouchStart={() => setIsBoost(true)}
          onMouseUp={() => setIsBoost(false)}
          onTouchEnd={() => setIsBoost(false)}
        >
          BOOST
        </BoostButton>
        <ShootButton onClick={shoot}>
          B
        </ShootButton>
      </ButtonContainer>

      {/* Joystick */}
      <JoystickContainer
        ref={joystickRef}
        onMouseDown={handleJoystickStart}
        onMouseMove={handleJoystickMove}
        onMouseUp={handleJoystickEnd}
        onMouseLeave={handleJoystickEnd}
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
      >
        <JoystickKnob x={joystickPos.x} y={joystickPos.y} />
      </JoystickContainer>

      {/* Player Stats */}
      <PlayerInfo>
        <div>Level {players[currentPlayer]?.level || 1}</div>
        <div>Score: {players[currentPlayer]?.score || 0}</div>
        <XPBar progress={(players[currentPlayer]?.xp || 0) % 100} />
      </PlayerInfo>
    </ViewPort>
  );
};

export default GameMap;
