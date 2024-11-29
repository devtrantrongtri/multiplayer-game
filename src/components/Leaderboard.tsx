import React from 'react';
import styled from 'styled-components';
import { Player } from '../types/Player';

const LeaderboardContainer = styled.div`
  position: fixed;
  top: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.8);
  padding: 15px;
  border-radius: 8px;
  color: white;
  min-width: 200px;
  z-index: 1000;
`;

const Title = styled.h3`
  margin: 0 0 10px 0;
  text-align: center;
  color: #ffd700;
`;

const PlayerList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const PlayerItem = styled.li<{ isCurrentPlayer: boolean }>`
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  color: ${props => props.isCurrentPlayer ? '#ffd700' : 'white'};
  font-weight: ${props => props.isCurrentPlayer ? 'bold' : 'normal'};
`;

interface LeaderboardProps {
  players: { [key: string]: Player };
  currentPlayerId: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ players, currentPlayerId }) => {
  const sortedPlayers = Object.values(players)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10);

  return (
    <LeaderboardContainer>
      <Title>Leaderboard</Title>
      <PlayerList>
        {sortedPlayers.map((player, index) => (
          <PlayerItem 
            key={player.id} 
            isCurrentPlayer={player.id === currentPlayerId}
          >
            <span>{index + 1}. {player.name}</span>
            <span>{player.score || 0}</span>
          </PlayerItem>
        ))}
      </PlayerList>
    </LeaderboardContainer>
  );
};

export default Leaderboard;
