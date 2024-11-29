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

interface PlayerSquareProps {
  color: string;
  isMoving: boolean;
  moveDirection: { x: number; y: number };
  isBoost: boolean;
  isCurrentPlayer?: boolean;
}

const PlayerSquare = styled.div<PlayerSquareProps>`
  position: absolute;
  width: ${GRID_SIZE}px;
  height: ${GRID_SIZE}px;
  background-color: ${props => props.color};
  border-radius: 8px;
  border: 2px solid rgba(0, 0, 0, 0.3);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: ${props => props.isCurrentPlayer ? 2 : 1};
  transform-origin: center;
  transition: transform 0.1s linear;
  ${props => props.isMoving ? `
    transform: rotate(${getPlayerTransform(props.moveDirection.x, props.moveDirection.y, props.isBoost)}deg) 
              scaleX(${getPlayerStretch(props.moveDirection.x, props.moveDirection.y, props.isBoost)}) 
              scaleY(${1/getPlayerStretch(props.moveDirection.x, props.moveDirection.y, props.isBoost)});
    ${props.isBoost ? `
      filter: blur(2px);
    ` : ''}
  ` : 'transform: rotate(0deg) scale(1);'}
`;

const PlayerName = styled.div<{ isCurrentPlayer: boolean }>`
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  color: ${props => props.isCurrentPlayer ? '#FFD700' : 'white'};
  font-weight: ${props => props.isCurrentPlayer ? 'bold' : 'normal'};
  font-size: 14px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
  white-space: nowrap;
  padding: 2px 6px;
  border-radius: 10px;
  background: ${props => props.isCurrentPlayer ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)'};
  z-index: 1;
`;

const PlayerScore = styled.div<{ isCurrentPlayer?: boolean }>`
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.6);
  color: ${props => props.isCurrentPlayer ? '#FFD700' : '#4CAF50'};
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 10px;
  white-space: nowrap;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  z-index: 2;
`;

const Trail = styled.div<{ opacity: number }>`
  position: absolute;
  width: ${GRID_SIZE}px;
  height: ${GRID_SIZE}px;
  background-color: rgba(255, 255, 255, ${props => props.opacity});
  transition: opacity 0.15s linear;
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
}

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

const DialogText = styled.div`
  margin: 0 0 2rem;
  color: #b8c6d1;
  font-size: 1.2rem;
  line-height: 1.6;
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

const DialogButton = styled.button`
  background: linear-gradient(to bottom, #4CAF50, #45a049);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 1px;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
    background: linear-gradient(to bottom, #45a049, #3d8b40);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.2);
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const { items, collectItem } = useItems();
  const { zones, isInDangerZone } = useDangerZones();

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

  // Item collection
  useEffect(() => {
    if (!currentPlayer || !players[currentPlayer]) return;

    const player = players[currentPlayer];
    Object.values(items).forEach(item => {
      const dx = player.x - item.x;
      const dy = player.y - item.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < COLLECT_DISTANCE) {
        collectItem(item.id, currentPlayer, player.score || 0);
        
        // Update player score
        const playerRef = ref(db, `players/${currentPlayer}`);
        const newScore = (player.score || 0) + 10;
        const newXP = (player.xp || 0) + 5;
        const newLevel = Math.floor(newXP / 100) + 1;
        
        update(playerRef, {
          score: newScore,
          xp: newXP,
          level: newLevel
        });
      }
    });
  }, [players, currentPlayer, items, collectItem]);

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

  if (showWelcome || !currentPlayer) {
    return <Auth onLogin={handleNameSubmit} />;
  }

  return (
    <ViewPort ref={viewportRef}>
      <MapContainer x={cameraPosition.x} y={cameraPosition.y}>
        <MapBackground />
        
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
            style={{
              left: player.x,
              top: player.y,
            }}
            color={player.color || '#ffffff'}
            isMoving={id === currentPlayer ? isMoving : false}
            moveDirection={id === currentPlayer ? moveDirection : player.direction}
            isBoost={id === currentPlayer ? isBoost : false}
            isCurrentPlayer={id === currentPlayer}
          >
            <PlayerName isCurrentPlayer={id === currentPlayer}>
              {player.name}
            </PlayerName>
            <PlayerScore isCurrentPlayer={id === currentPlayer}>
              Score: {player.score || 0}
            </PlayerScore>
          </PlayerSquare>
        ))}

        <Leaderboard players={players} currentPlayerId={currentPlayer} />
      </MapContainer>

      {/* Controls */}
      <JoystickContainer>
        <ReactNipple
          options={{
            mode: 'static',
            position: { top: '50%', left: '50%' },
            color: 'white',
            size: 150,
          }}
          style={{
            width: 150,
            height: 150,
            position: 'relative',
            background: 'rgba(0, 0, 0, 0.1)',
            borderRadius: '50%',
          }}
          onMove={(evt, data) => {
            if (!currentPlayer || !players[currentPlayer]) return;

            const player = players[currentPlayer];
            const baseSpeed = (player.speed || PLAYER_SPEED) * (GRID_SIZE / 10);
            const currentSpeed = baseSpeed * (isBoost ? boostLevel : 1);
            const force = Math.min(1, data.force);

            const angle = data.angle.radian;
            const deltaX = Math.cos(angle) * force * currentSpeed;
            const deltaY = -Math.sin(angle) * force * currentSpeed;

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
          }}
          onEnd={() => {
            setIsMoving(false);
            setMoveDirection({ x: 0, y: 0 });
          }}
        />
      </JoystickContainer>

      <BoostButton
        isBoost={isBoost}
        onTouchStart={() => setIsBoost(true)}
        onTouchEnd={() => setIsBoost(false)}
        onMouseDown={() => setIsBoost(true)}
        onMouseUp={() => setIsBoost(false)}
      >
        BOOST
      </BoostButton>

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
