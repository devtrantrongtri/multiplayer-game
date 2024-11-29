import React, { useState } from 'react';
import styled from 'styled-components';
import { ref, get, set } from 'firebase/database';
import { db } from '../firebase';

const AuthContainer = styled.div`
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

const AuthForm = styled.form`
  background: linear-gradient(to bottom, #2c3e50, #1a2634);
  padding: 2.5rem;
  border-radius: 16px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const Title = styled.h2`
  color: white;
  text-align: center;
  margin-bottom: 2rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.8rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  color: white;
  outline: none;

  &:focus {
    border-color: #4CAF50;
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 1rem;
  background: linear-gradient(to bottom, #4CAF50, #45a049);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  margin-bottom: 1rem;

  &:hover {
    background: linear-gradient(to bottom, #45a049, #3d8b40);
  }
`;

const ErrorMessage = styled.div`
  color: #ff6b6b;
  margin-bottom: 1rem;
  text-align: center;
`;

const ToggleText = styled.p`
  color: #b8c6d1;
  text-align: center;
  cursor: pointer;

  &:hover {
    color: white;
  }
`;

interface AuthProps {
  onLogin: (playerName: string) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      const users = snapshot.val() || {};

      if (isLogin) {
        // Login
        if (users[username] && users[username].password === password) {
          onLogin(username);
        } else {
          setError('Invalid username or password');
        }
      } else {
        // Register
        if (users[username]) {
          setError('Username already exists');
        } else {
          await set(ref(db, `users/${username}`), { password });
          setIsLogin(true); // Switch to login after successful registration
          setError('Registration successful! Please log in.');
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      setError('An error occurred during authentication');
    }
  };

  return (
    <AuthContainer>
      <AuthForm onSubmit={handleSubmit}>
        <Title>{isLogin ? 'Login' : 'Register'}</Title>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit">{isLogin ? 'Login' : 'Register'}</Button>
        <ToggleText onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
        </ToggleText>
      </AuthForm>
    </AuthContainer>
  );
};

export default Auth;
