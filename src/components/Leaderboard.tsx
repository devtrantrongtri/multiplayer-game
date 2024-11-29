import React, { useState } from 'react';
import styled from 'styled-components';
import { Player } from '../types/Player';

const LeaderboardContainer = styled.div<{ isVisible: boolean }>`
  position: fixed;
  top: 20px;
  right: ${props => props.isVisible ? '20px' : '-300px'};
  width: 250px;
  background-color: rgba(0, 0, 0, 0.8);
  border-radius: 10px;
  padding: 15px;
  color: white;
  transition: right 0.3s ease-in-out;
  z-index: 1000;
`;

const Title = styled.h2`
  margin: 0 0 15px 0;
  font-size: 18px;
  text-align: center;
`;

const PlayerItem = styled.div<{ isCurrentPlayer: boolean }>`
  display: flex;
  justify-content: space-between;
  padding: 5px 10px;
  margin: 5px 0;
  background-color: ${props => props.isCurrentPlayer ? 'rgba(255, 255, 255, 0.2)' : 'transparent'};
  border-radius: 5px;
  font-size: 14px;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
`;

const ToggleButton = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 8px 15px;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  z-index: 1001;

  &:hover {
    background-color: rgba(0, 0, 0, 0.9);
  }
`;

interface LeaderboardProps {
  players: { [key: string]: Player };
  currentPlayerId: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ players, currentPlayerId }) => {
  const [isVisible, setIsVisible] = useState(true);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const sortedPlayers = Object.values(players)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10);

  return (
    <>
      <ToggleButton onClick={toggleVisibility}>
        {isVisible ? 'Hide' : 'Show'} Leaderboard
      </ToggleButton>
      <LeaderboardContainer isVisible={isVisible}>
        <Title>Top 10 Players</Title>
        {sortedPlayers.map((player, index) => (
          <PlayerItem
            key={player.id}
            isCurrentPlayer={player.id === currentPlayerId}
          >
            <span>{index + 1}. {player.name}</span>
            <span>{player.score || 0}</span>
          </PlayerItem>
        ))}
      </LeaderboardContainer>
    </>
  );
};

export default Leaderboard;
