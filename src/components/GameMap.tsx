import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import ReactNipple from 'react-nipple';
import 'react-nipple/lib/styles.css';
import { database } from '../firebase';
import { ref, onValue, set } from 'firebase/database';
import { Player as PlayerType, Item as ItemType } from '../types/Player';
import { useItems } from '../hooks/useItems';
import Leaderboard from './Leaderboard';

const GRID_SIZE = 50; // Kích thước của mỗi ô grid
const MAP_WIDTH = 2000; // Chiều rộng map tổng
const MAP_HEIGHT = 2000; // Chiều cao map tổng
const PLAYER_SPEED = 1; // Giảm tốc độ xuống 1
const COLLECT_DISTANCE = 30; // Khoảng cách để thu thập vật phẩm

const ViewPort = styled.div`
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background-color: #f0f0f0;
`;

const MapContainer = styled.div<{ x: number; y: number }>`
  width: ${MAP_WIDTH}px;
  height: ${MAP_HEIGHT}px;
  position: absolute;
  left: ${props => -props.x}px;
  top: ${props => -props.y}px;
  background-color: #f0f0f0;
  background-image: 
    linear-gradient(to right, #ddd 1px, transparent 1px),
    linear-gradient(to bottom, #ddd 1px, transparent 1px);
  background-size: ${GRID_SIZE}px ${GRID_SIZE}px;
  transition: all 0.1s linear;
`;

const PlayerSquare = styled.div<{ x: number; y: number; color: string; isCurrentPlayer?: boolean }>`
  position: absolute;
  width: 30px;
  height: 30px;
  background-color: ${props => props.color};
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
  transition: all 0.1s linear;
  border: 2px solid rgba(0, 0, 0, 0.3);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: ${props => props.isCurrentPlayer ? 2 : 1};
`;

const ItemSquare = styled.div<{ x: number; y: number; type: 'coin' | 'star' }>`
  position: absolute;
  width: 20px;
  height: 20px;
  left: ${props => props.x + 15}px;
  top: ${props => props.y + 15}px;
  background-color: ${props => props.type === 'star' ? '#ffd700' : '#ffb900'};
  border-radius: ${props => props.type === 'star' ? '5px' : '50%'};
  transform: ${props => props.type === 'star' ? 'rotate(45deg)' : 'none'};
  transition: all 0.1s linear;
  z-index: 1;
  box-shadow: 0 0 10px ${props => props.type === 'star' ? '#ffd700' : '#ffb900'};
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

interface GameMapProps {
  playerName: string;
}

const GameMap: React.FC<GameMapProps> = ({ playerName }) => {
  const [players, setPlayers] = useState<{ [key: string]: PlayerType }>({});
  const playerId = useRef(Date.now().toString());
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const { items, collectItem } = useItems();

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

  const handleMove = (evt: any, data: any) => {
    if (players[playerId.current] && data.direction) {
      const currentPlayer = players[playerId.current];
      const speed = (currentPlayer.speed || PLAYER_SPEED) * (GRID_SIZE / 10);
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
          deltaX = -speed * 0.707; // cos(45°)
          deltaY = -speed * 0.707; // sin(45°)
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

      // Áp dụng lực từ joystick
      deltaX *= data.force;
      deltaY *= data.force;

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
        {Object.values(items).map((item) => (
          <ItemSquare
            key={item.id}
            x={item.x}
            y={item.y}
            type={item.type}
          />
        ))}
        {Object.values(players).map((player) => (
          <PlayerSquare 
            key={player.id}
            x={player.x}
            y={player.y}
            color={player.color}
            isCurrentPlayer={player.id === playerId.current}
          >
            {player.name}
          </PlayerSquare>
        ))}
      </MapContainer>
      <Leaderboard 
        players={players} 
        currentPlayerId={playerId.current} 
      />
      <MapOverlay>
        Grid Size: {GRID_SIZE}px
        <br />
        Map: {MAP_WIDTH}x{MAP_HEIGHT}
        <br />
        Score: {players[playerId.current]?.score || 0}
      </MapOverlay>
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
    </ViewPort>
  );
};

export default GameMap;
