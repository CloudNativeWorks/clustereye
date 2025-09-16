declare module 'react-hexagon' {
  import { ReactNode } from 'react';

  interface HexagonProps {
    style?: React.CSSProperties;
    children?: ReactNode;
    flatTop?: boolean;
    [key: string]: any;
  }

  const Hexagon: React.FC<HexagonProps>;
  export default Hexagon;
} 