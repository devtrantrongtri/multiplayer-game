import React from 'react';
import styled from 'styled-components';
import { Player as PlayerType } from '../types/Player';

interface PlayerProps {
  player: PlayerType;
}

const PlayerSquare = styled.div<{ x: number; y: number; color: string }>`
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
`;

export const Player: React.FC<PlayerProps> = ({ player }) => {
  return (
    <PlayerSquare x={player.x} y={player.y} color={player.color}>
      {player.name}
    </PlayerSquare>
  );
};
