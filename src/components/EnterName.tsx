// src/components/EnterName.tsx
import React, { useState } from 'react';
import styled from 'styled-components';

interface EnterNameProps {
  onSubmit: (name: string) => void;
}

const Container = styled.div`
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

const Form = styled.form`
  background: linear-gradient(to bottom, #2c3e50, #1a2634);
  padding: 2.5rem;
  border-radius: 16px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
`;

const Title = styled.h2`
  color: white;
  margin-bottom: 1.5rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.8rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  color: white;
  font-size: 16px;
  outline: none;

  &:focus {
    border-color: #4CAF50;
  }
`;

const Button = styled.button`
  padding: 0.8rem 2rem;
  background: linear-gradient(to bottom, #4CAF50, #45a049);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.2s;

  &:hover {
    background: linear-gradient(to bottom, #45a049, #3d8b40);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const ErrorMessage = styled.div`
  color: #ff6b6b;
  margin-top: 0.5rem;
  font-size: 14px;
`;

const EnterName: React.FC<EnterNameProps> = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      setError('Please enter a name');
      return;
    }
    
    if (trimmedName.length < 3) {
      setError('Name must be at least 3 characters long');
      return;
    }
    
    if (trimmedName.length > 15) {
      setError('Name must be less than 15 characters');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedName)) {
      setError('Name can only contain letters, numbers, and underscores');
      return;
    }

    setError('');
    onSubmit(trimmedName);
  };

  return (
    <Container>
      <Form onSubmit={handleSubmit}>
        <Title>Nhập tên của bạn:</Title>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên của bạn"
          autoFocus
          maxLength={15}
        />
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Button type="submit">Tham gia</Button>
      </Form>
    </Container>
  );
};

export default EnterName;
