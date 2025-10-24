
import React from 'react';
import { Card as CardType } from './Game';

interface CardProps {
  card: CardType;
  onClick: () => void;
  crackFall?: boolean;
}

const Card: React.FC<CardProps> = ({ card, onClick, crackFall }) => {
  return (
    <div
      className={`game-card${card.flipped || card.matched ? ' flipped' : ''}${card.matched ? ' matched' : ''}${crackFall ? ' crack-fall' : ''}`}
      style={{ background: card.flipped || card.matched ? card.color : undefined }}
      onClick={onClick}
    >
      {card.flipped || card.matched ? '' : '?'}
    </div>
  );
};

export default Card;
