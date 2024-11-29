import React from 'react';
import styled from 'styled-components';
import { Player as PlayerType } from '../types/Player';

interface PlayerProps {
  player: PlayerType;
  isCurrentPlayer?: boolean;
}

const PlayerContainer = styled.div`
  position: relative;
  width: 50px;
  height: 50px;
`;

const PlayerSquare = styled.div<{ color: string; isCurrentPlayer?: boolean }>`
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: ${props => props.color};
  border-radius: 8px;
  border: 2px solid ${props => props.isCurrentPlayer ? '#FFD700' : 'rgba(0, 0, 0, 0.3)'};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.1s linear;
  z-index: ${props => props.isCurrentPlayer ? 2 : 1};
`;

const PlayerName = styled.div<{ isCurrentPlayer?: boolean }>`
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  background-color: ${props => props.isCurrentPlayer ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)'};
  color: ${props => props.isCurrentPlayer ? '#FFD700' : 'white'};
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  white-space: nowrap;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  z-index: 2;
  border: 1px solid ${props => props.isCurrentPlayer ? '#FFD700' : 'rgba(255, 255, 255, 0.2)'};
`;

const PlayerLevel = styled.div`
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.6);
  color: #4CAF50;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 10px;
  white-space: nowrap;
`;

export const Player: React.FC<PlayerProps> = ({ player, isCurrentPlayer }) => {
  return (
    <PlayerContainer>
      <PlayerName isCurrentPlayer={isCurrentPlayer}>
        {player.name}
      </PlayerName>
      <PlayerSquare color={player.color} isCurrentPlayer={isCurrentPlayer} />
      <PlayerLevel>
        Lv.{player.level}
      </PlayerLevel>
    </PlayerContainer>
  );
};
