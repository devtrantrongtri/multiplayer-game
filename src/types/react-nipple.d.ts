// src/types/react-nipple.d.ts

declare module 'react-nipple' {
    import * as React from 'react';
  
    // Định nghĩa kiểu cho dữ liệu đầu ra của joystick
    export interface JoystickOutputData {
      angle: {
        degree: number;
        radian: number;
      };
      direction: {
        angle: string; // 'up', 'down', 'left', 'right', etc.
        x: string;     // 'left' or 'right'
        y: string;     // 'up' or 'down'
      };
      distance: number;
      force: number;
      identifier: number;
      instance: any;
      position: {
        x: number;
        y: number;
      };
      pressure: number;
      vector: {
        x: number;
        y: number;
      };
    }
  
    export interface NippleProps {
      options?: any;
      style?: React.CSSProperties;
      className?: string;
      onStart?: (evt: any, data: JoystickOutputData) => void;
      onEnd?: (evt: any, data: JoystickOutputData) => void;
      onMove?: (evt: any, data: JoystickOutputData) => void;
      onDir?: (evt: any, data: JoystickOutputData) => void;
      onPlain?: (evt: any, data: JoystickOutputData) => void;
      onShown?: (evt: any, data: JoystickOutputData) => void;
      onHidden?: (evt: any, data: JoystickOutputData) => void;
      onPressure?: (evt: any, data: JoystickOutputData) => void;
    }
  
    export class Nipple extends React.Component<NippleProps> {}
  
    export default Nipple;
  }
  