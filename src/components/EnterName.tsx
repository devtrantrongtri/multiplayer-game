// src/components/EnterName.tsx
import React, { useState } from 'react';

interface EnterNameProps {
  onSubmit: (name: string) => void;
}

const EnterName: React.FC<EnterNameProps> = ({ onSubmit }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Nhập tên của bạn:</h2>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ padding: '10px', fontSize: '16px' }}
      />
      <button type="submit" style={{ padding: '10px 20px', fontSize: '16px', marginLeft: '10px' }}>
        Tham gia
      </button>
    </form>
  );
};

export default EnterName;
