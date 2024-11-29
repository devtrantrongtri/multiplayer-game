import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import ReactNipple from 'react-nipple';
import 'react-nipple/lib/styles.css';
import { database } from '../firebase';
import { ref, onValue, set } from 'firebase/database';
import { Player as PlayerType, Item as ItemType } from '../types/Player';
import { useItems } from '../hooks/useItems';
import { useDangerZones } from '../hooks/useDangerZones';
import Leaderboard from './Leaderboard';

const GRID_SIZE = 50; // Kích thước của mỗi ô grid
const MAP_WIDTH = 2000; // Chiều rộng map tổng
const MAP_HEIGHT = 2000; // Chiều cao map tổng
const PLAYER_SPEED = 2; // Giảm tốc độ xuống 1
const COLLECT_DISTANCE = 30; // Khoảng cách để thu thập vật phẩm
const BASE_BOOST_MULTIPLIER = 4; // Tốc độ tăng tốc mặc định (2x)
const MAX_BOOST_MULTIPLIER = 6; // Tốc độ tăng tốc tối đa (3.5x)
const BOOST_INCREMENT = 0.3; // Tốc độ tăng mỗi giây (30%)

const KEYS = {
  UP: ['ArrowUp', 'w', 'W'],
  DOWN: ['ArrowDown', 's', 'S'],
  LEFT: ['ArrowLeft', 'a', 'A'],
  RIGHT: ['ArrowRight', 'd', 'D'],
  BOOST: [' '] // Space key
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

const MotionTrail = styled.div<{ x: number; y: number; color: string; opacity: number; scale: number }>`
  position: absolute;
  width: 30px;
  height: 30px;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  background-color: ${props => props.color};
  border-radius: 50%;
  opacity: ${props => props.opacity};
  transform: scale(${props => props.scale});
  transition: all 0.15s linear;
  pointer-events: none;
`;

const PlayerSquare = styled.div<{ 
  x: number; 
  y: number; 
  color: string; 
  isCurrentPlayer?: boolean;
  isMoving: boolean;
  moveDirection: { x: number; y: number };
  isBoost: boolean;
}>`
  position: absolute;
  width: 30px;
  height: 30px;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  background-color: ${props => props.color};
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.3);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: ${props => props.isCurrentPlayer ? 2 : 1};
  transform-origin: center;
  transition: transform 0.1s linear;
  ${props => props.isMoving && `
    ${props.isBoost ? `
      filter: blur(2px);
      transform: scaleX(1.3) scaleY(0.8);
    ` : ''}
    transform: rotate(${getPlayerTransform(props.moveDirection.x, props.moveDirection.y, props.isBoost)}deg) scaleX(${getPlayerStretch(props.moveDirection.x, props.moveDirection.y, props.isBoost)}) scaleY(${1/getPlayerStretch(props.moveDirection.x, props.moveDirection.y, props.isBoost)});
  `}
`;

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

const HealthBar = styled.div<{ health: number }>`
  width: 100px;
  height: 10px;
  background-color: #333;
  border-radius: 5px;
  overflow: hidden;
  margin-top: 5px;

  &::after {
    content: '';
    display: block;
    width: ${props => props.health}%;
    height: 100%;
    background-color: ${props => props.health > 50 ? '#4CAF50' : props.health > 25 ? '#FFC107' : '#F44336'};
    transition: all 0.3s ease;
  }
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
  bottom: 50px;
  left: 50px;
  z-index: 1000;
`;

const MapOverlay = styled.div`
  position: fixed;
  top: 10px;
  right: 10px;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 10px;
  border-radius: 5px;
  font-size: 12px;
  z-index: 1000;
`;

const BoostButton = styled.button<{ isBoost: boolean }>`
  position: fixed;
  bottom: 120px;
  right: 40px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: ${props => props.isBoost ? 'rgba(255, 99, 71, 0.8)' : 'rgba(0, 0, 0, 0.6)'};
  border: 2px solid ${props => props.isBoost ? '#ff6347' : '#ffffff'};
  color: white;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  touch-action: manipulation;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  
  &:active {
    transform: scale(0.95);
  }

  &::before {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background-color: ${props => props.isBoost ? 'rgba(255, 99, 71, 0.3)' : 'transparent'};
    animation: ${props => props.isBoost ? 'pulse 1s infinite' : 'none'};
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 0.8;
    }
    50% {
      transform: scale(1.2);
      opacity: 0.4;
    }
    100% {
      transform: scale(1);
      opacity: 0.8;
    }
  }
`;

interface GameMapProps {
  playerName: string;
}

const GameMap: React.FC<GameMapProps> = ({ playerName }) => {
  const [players, setPlayers] = useState<{ [key: string]: PlayerType }>({});
  const playerId = useRef(Date.now().toString());
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const { items, collectItem } = useItems();
  const { zones, isInDangerZone } = useDangerZones();
  const damageInterval = useRef<NodeJS.Timeout>();
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const [isBoost, setIsBoost] = useState(false);
  const [trails, setTrails] = useState<Array<{x: number; y: number; opacity: number; id: number}>>([]);
  const [moveDirection, setMoveDirection] = useState({ x: 0, y: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const lastTrailTime = useRef(0);
  const [boostLevel, setBoostLevel] = useState(BASE_BOOST_MULTIPLIER);

  useEffect(() => {
    // Initialize player
    const playerRef = ref(database, `players/${playerId.current}`);
    const newPlayer: PlayerType = {
      id: playerId.current,
      name: playerName,
      x: Math.floor(Math.random() * (MAP_WIDTH - 50) / GRID_SIZE) * GRID_SIZE,
      y: Math.floor(Math.random() * (MAP_HEIGHT - 50) / GRID_SIZE) * GRID_SIZE,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
      speed: PLAYER_SPEED,
      score: 0,
      health: 100,
      level: 1,
      xp: 0,
    };
    
    set(playerRef, newPlayer);

    // Listen for players changes
    const playersRef = ref(database, 'players');
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPlayers(data);
      }
    });

    // Cleanup
    return () => {
      set(playerRef, null);
      unsubscribe();
    };
  }, [playerName]);

  // Update camera position to follow current player
  useEffect(() => {
    if (players[playerId.current] && viewportRef.current) {
      const player = players[playerId.current];
      const viewport = viewportRef.current;
      const viewportWidth = viewport.clientWidth;
      const viewportHeight = viewport.clientHeight;

      const targetX = player.x - viewportWidth / 2;
      const targetY = player.y - viewportHeight / 2;

      // Giới hạn camera trong map
      const newX = Math.max(0, Math.min(MAP_WIDTH - viewportWidth, targetX));
      const newY = Math.max(0, Math.min(MAP_HEIGHT - viewportHeight, targetY));

      setCameraPosition({ x: newX, y: newY });
    }
  }, [players]);

  // Check for item collection
  useEffect(() => {
    const currentPlayer = players[playerId.current];
    if (!currentPlayer) return;

    Object.values(items).forEach(item => {
      const dx = currentPlayer.x - item.x;
      const dy = currentPlayer.y - item.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < COLLECT_DISTANCE) {
        collectItem(item.id, playerId.current, currentPlayer.score || 0);
      }
    });
  }, [players, items, collectItem]);

  // Xử lý sát thương từ khu vực nguy hiểm
  useEffect(() => {
    const currentPlayer = players[playerId.current];
    if (!currentPlayer) return;

    // Clear previous interval
    if (damageInterval.current) {
      clearInterval(damageInterval.current);
    }

    // Check for danger zone damage
    damageInterval.current = setInterval(() => {
      const zone = isInDangerZone(currentPlayer.x, currentPlayer.y);
      if (zone && currentPlayer.health > 0) {
        const newHealth = currentPlayer.health - zone.damage;
        const playerRef = ref(database, `players/${playerId.current}`);
        set(playerRef, {
          ...currentPlayer,
          health: Math.max(0, newHealth),
        });
      }
    }, 1000);

    return () => {
      if (damageInterval.current) {
        clearInterval(damageInterval.current);
      }
    };
  }, [players, isInDangerZone]);

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
  }, []);

  // Update boost effect
  useEffect(() => {
    if (!isBoost) {
      setBoostLevel(BASE_BOOST_MULTIPLIER);
      return;
    }

    const boostInterval = setInterval(() => {
      setBoostLevel(prev => Math.min(prev + BOOST_INCREMENT, MAX_BOOST_MULTIPLIER));
    }, 1000);

    return () => clearInterval(boostInterval);
  }, [isBoost]);

  // Keyboard movement
  useEffect(() => {
    if (!players[playerId.current] || pressedKeys.size === 0) {
      setIsMoving(false);
      setMoveDirection({ x: 0, y: 0 });
      return;
    }

    const moveInterval = setInterval(() => {
      const currentPlayer = players[playerId.current];
      const speed = (currentPlayer.speed || PLAYER_SPEED) * (GRID_SIZE / 10) * (isBoost ? boostLevel : 1);
      let deltaX = 0;
      let deltaY = 0;

      if (pressedKeys.has('UP')) deltaY -= speed;
      if (pressedKeys.has('DOWN')) deltaY += speed;
      if (pressedKeys.has('LEFT')) deltaX -= speed;
      if (pressedKeys.has('RIGHT')) deltaX += speed;

      if (deltaX !== 0 || deltaY !== 0) {
        setIsMoving(true);
        setMoveDirection({ x: deltaX, y: deltaY });
        if (isBoost) {
          const now = Date.now();
          if (now - lastTrailTime.current < 50) return; // Limit trail frequency
          lastTrailTime.current = now;

          const newTrail = {
            x: currentPlayer.x,
            y: currentPlayer.y,
            opacity: 0.3,
            id: now,
          };

          setTrails(prev => [...prev, newTrail]);
          setTimeout(() => {
            setTrails(prev => prev.filter(trail => trail.id !== newTrail.id));
          }, 300);
        }
      } else {
        setIsMoving(false);
        setMoveDirection({ x: 0, y: 0 });
      }

      // Normalize diagonal movement
      if (deltaX !== 0 && deltaY !== 0) {
        deltaX *= 0.707;
        deltaY *= 0.707;
      }

      // Giới hạn tốc độ tối đa
      const maxSpeed = (GRID_SIZE / 6) * (isBoost ? 1.5 : 1);
      const currentSpeed = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (currentSpeed > maxSpeed) {
        const scale = maxSpeed / currentSpeed;
        deltaX *= scale;
        deltaY *= scale;
      }

      // Giới hạn trong map
      const newX = Math.max(0, Math.min(MAP_WIDTH - 30, currentPlayer.x + deltaX));
      const newY = Math.max(0, Math.min(MAP_HEIGHT - 30, currentPlayer.y + deltaY));

      if (newX !== currentPlayer.x || newY !== currentPlayer.y) {
        const playerRef = ref(database, `players/${playerId.current}`);
        set(playerRef, {
          ...currentPlayer,
          x: newX,
          y: newY,
        });
      }
    }, 16); // 60fps

    return () => clearInterval(moveInterval);
  }, [players, pressedKeys, isBoost, boostLevel]);

  const handleMove = (evt: any, data: any) => {
    if (players[playerId.current] && data.direction) {
      const currentPlayer = players[playerId.current];
      const speed = (currentPlayer.speed || PLAYER_SPEED) * (GRID_SIZE / 10) * (isBoost ? boostLevel : 1);
      let deltaX = 0;
      let deltaY = 0;

      // Di chuyển theo hướng của joystick
      switch (data.direction.angle) {
        case 'up':
          deltaY = -speed;
          break;
        case 'down':
          deltaY = speed;
          break;
        case 'left':
          deltaX = -speed;
          break;
        case 'right':
          deltaX = speed;
          break;
        case 'up:left':
          deltaX = -speed * 0.707;
          deltaY = -speed * 0.707;
          break;
        case 'up:right':
          deltaX = speed * 0.707;
          deltaY = -speed * 0.707;
          break;
        case 'down:left':
          deltaX = -speed * 0.707;
          deltaY = speed * 0.707;
          break;
        case 'down:right':
          deltaX = speed * 0.707;
          deltaY = speed * 0.707;
          break;
      }

      // Áp dụng lực từ joystick với giới hạn
      const force = Math.min(data.force, 0.9); 
      deltaX *= force;
      deltaY *= force;

      // Giới hạn tốc độ tối đa
      const maxSpeed = GRID_SIZE / 6; 
      const currentSpeed = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (currentSpeed > maxSpeed) {
        const scale = maxSpeed / currentSpeed;
        deltaX *= scale;
        deltaY *= scale;
      }

      // Giới hạn trong map
      const newX = Math.max(0, Math.min(MAP_WIDTH - 30, currentPlayer.x + deltaX));
      const newY = Math.max(0, Math.min(MAP_HEIGHT - 30, currentPlayer.y + deltaY));

      const playerRef = ref(database, `players/${playerId.current}`);
      set(playerRef, {
        ...currentPlayer,
        x: newX,
        y: newY,
      });
    }
  };

  return (
    <ViewPort ref={viewportRef}>
      <MapContainer x={cameraPosition.x} y={cameraPosition.y}>
        <MapBackground />
        {zones.map((zone, index) => (
          <DangerZone
            key={index}
            x={zone.x}
            y={zone.y}
            width={zone.width}
            height={zone.height}
          />
        ))}
        {Object.values(items).map((item) => (
          <ItemSquare
            key={item.id}
            x={item.x}
            y={item.y}
            type={item.type}
          />
        ))}
        {trails.map(trail => (
          <MotionTrail
            key={trail.id}
            x={trail.x}
            y={trail.y}
            color={players[playerId.current]?.color || '#fff'}
            opacity={trail.opacity}
            scale={0.8}
          />
        ))}
        {Object.values(players).map((player) => (
          <PlayerSquare
            key={player.id}
            x={player.x}
            y={player.y}
            color={player.color}
            isCurrentPlayer={player.id === playerId.current}
            isMoving={isMoving && player.id === playerId.current}
            moveDirection={moveDirection}
            isBoost={isBoost}
          >
            {player.name}
          </PlayerSquare>
        ))}
      </MapContainer>
      <PlayerInfo>
        <div>Level {players[playerId.current]?.level || 1}</div>
        <XPBar progress={(players[playerId.current]?.xp % 100) || 0} />
        <div>HP: {players[playerId.current]?.health || 100}</div>
        <HealthBar health={players[playerId.current]?.health || 100} />
        <div>Score: {players[playerId.current]?.score || 0}</div>
      </PlayerInfo>
      <Leaderboard 
        players={players} 
        currentPlayerId={playerId.current} 
      />
      {/* <MapOverlay>
        Grid Size: {GRID_SIZE}px
        <br />
        Map: {MAP_WIDTH}x{MAP_HEIGHT}
        <br />
        Score: {players[playerId.current]?.score || 0}
      </MapOverlay> */}
      <JoystickContainer>
        <ReactNipple
          options={{ 
            mode: 'static', 
            position: { top: '50%', left: '50%' },
            color: '#000000',
            size: 100,
            lockX: false,
            lockY: false,
          }}
          style={{
            width: 150,
            height: 150,
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            border: '1px solid #cccccc'
          }}
          onMove={handleMove}
        />
      </JoystickContainer>
      <BoostButton 
        isBoost={isBoost}
        onTouchStart={() => setIsBoost(true)}
        onTouchEnd={() => setIsBoost(false)}
        onMouseDown={() => setIsBoost(true)}
        onMouseUp={() => setIsBoost(false)}
        onMouseLeave={() => setIsBoost(false)}
      >
        BOOST
      </BoostButton>
    </ViewPort>
  );
};

export default GameMap;
