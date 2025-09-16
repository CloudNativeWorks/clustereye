import React, { useEffect, useRef, useState } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type: 'master' | 'worker' | 'data';
  angle?: number;
  orbitRadius?: number;
  orbitSpeed?: number;
  pulsePhase?: number;
}

interface Connection {
  from: Node;
  to: Node;
  particles: Particle[];
}

interface Particle {
  x: number;
  y: number;
  progress: number;
  speed: number;
  size: number;
}

interface AISymbol {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'binary' | 'chip' | 'neural' | 'text' | 'database' | 'dblogo';
  content: string;
  opacity: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  logoType?: 'mssql' | 'mongodb' | 'postgresql' | 'mysql' | 'oracle';
}

const AINetworkBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const nodesRef = useRef<Node[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const aiSymbolsRef = useRef<AISymbol[]>([]);
  const lastTimeRef = useRef<number>(0);
  const logoImagesRef = useRef<{ [key: string]: HTMLImageElement }>({});

  // Colors
  const colors = {
    master: '#3B82F6',
    worker: '#9333EA',
    data: '#3B82F6',
    connection: 'rgba(255, 255, 255, 0.4)',
    particle: '#FFFFFF',
    aiSymbol: 'rgba(59, 130, 246, 0.6)',
    aiText: 'rgba(147, 51, 234, 0.7)'
  };

  // Load database logos
  const loadDatabaseLogos = () => {
    const logos = {
      mssql: '/sql_server.svg',
      mongodb: '/mongo.svg', 
      postgresql: '/postgresql.svg',
      mysql: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg',
      oracle: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/oracle/oracle-original.svg'
    };

    Object.entries(logos).forEach(([key, src]) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        logoImagesRef.current[key] = img;
      };
      img.onerror = () => {
        console.warn(`Failed to load logo: ${key}`);
      };
      img.src = src;
    });
  };

  // Initialize nodes
  const initializeNodes = (width: number, height: number) => {
    const nodes: Node[] = [];
    const centerX = width / 2;
    const centerY = height / 2;

    // Master node (center)
    nodes.push({
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      radius: 30,
      color: colors.master,
      type: 'master',
      pulsePhase: 0
    });

    // Worker nodes (orbiting)
    const workerCount = 7;
    const orbitRadius = Math.min(width, height) * 0.2;
    for (let i = 0; i < workerCount; i++) {
      const angle = (i / workerCount) * Math.PI * 2;
      nodes.push({
        x: centerX + Math.cos(angle) * orbitRadius,
        y: centerY + Math.sin(angle) * orbitRadius,
        vx: 0,
        vy: 0,
        radius: 12,
        color: colors.worker,
        type: 'worker',
        angle: angle,
        orbitRadius: orbitRadius,
        orbitSpeed: 0.5 + Math.random() * 0.3,
        pulsePhase: Math.random() * Math.PI * 2
      });
    }

    // Data nodes (random movement)
    const dataCount = 18;
    for (let i = 0; i < dataCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 4 + Math.random() * 3,
        color: colors.data,
        type: 'data',
        pulsePhase: Math.random() * Math.PI * 2
      });
    }

    return nodes;
  };

  // Initialize connections
  const initializeConnections = (nodes: Node[]) => {
    const connections: Connection[] = [];
    const masterNode = nodes.find(n => n.type === 'master')!;
    const workerNodes = nodes.filter(n => n.type === 'worker');
    const dataNodes = nodes.filter(n => n.type === 'data');

    // Connect master to workers
    workerNodes.forEach(worker => {
      connections.push({
        from: masterNode,
        to: worker,
        particles: []
      });
    });

    // Connect some workers to data nodes
    dataNodes.forEach(dataNode => {
      const nearestWorker = workerNodes.reduce((nearest, worker) => {
        const distToWorker = Math.hypot(worker.x - dataNode.x, worker.y - dataNode.y);
        const distToNearest = Math.hypot(nearest.x - dataNode.x, nearest.y - dataNode.y);
        return distToWorker < distToNearest ? worker : nearest;
      });

      if (Math.random() < 0.4) { // 40% chance of connection
        connections.push({
          from: nearestWorker,
          to: dataNode,
          particles: []
        });
      }
    });

    return connections;
  };

  // Initialize AI symbols
  const initializeAISymbols = (width: number, height: number) => {
    const symbols: AISymbol[] = [];
    
    // Binary codes
    const binaryCodes = ['01001001', '11010011', '10110101', '01110010', '11001010', '10101111'];
    for (let i = 0; i < 8; i++) {
      symbols.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        type: 'binary',
        content: binaryCodes[Math.floor(Math.random() * binaryCodes.length)],
        opacity: 0.3 + Math.random() * 0.4,
        size: 12 + Math.random() * 4,
        rotation: 0,
        rotationSpeed: 0
      });
    }

    // AI Text labels
    const aiTexts = ['AI PROCESSING', 'NEURAL NET', 'DEEP LEARNING', 'ML ANALYSIS', 'AI ADVISOR', 'SMART QUERY', 'DB CLUSTER', 'PERFORMANCE AI', 'QUERY OPTIMIZER'];
    for (let i = 0; i < 5; i++) {
      symbols.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        type: 'text',
        content: aiTexts[Math.floor(Math.random() * aiTexts.length)],
        opacity: 0.2 + Math.random() * 0.3,
        size: 10 + Math.random() * 2,
        rotation: 0,
        rotationSpeed: 0
      });
    }



    // Database logos floating around
    const dbTypes = ['mssql', 'mongodb', 'postgresql', 'mysql', 'oracle'];
    for (let i = 0; i < 12; i++) {
      const logoType = dbTypes[Math.floor(Math.random() * dbTypes.length)] as 'mssql' | 'mongodb' | 'postgresql' | 'mysql' | 'oracle';
      
      // Make Oracle and MongoDB logos bigger
      let baseSize = 20;
      if (logoType === 'oracle' || logoType === 'mongodb') {
        baseSize = 30;
      }
      
      symbols.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        type: 'dblogo',
        content: '',
        opacity: 0.4 + Math.random() * 0.4,
        size: baseSize + Math.random() * 15,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.002,
        logoType: logoType
      });
    }

    // Neural network patterns
    for (let i = 0; i < 4; i++) {
      symbols.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        type: 'neural',
        content: '◈',
        opacity: 0.2 + Math.random() * 0.3,
        size: 12 + Math.random() * 8,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.003
      });
    }

    return symbols;
  };

  // Update nodes animation
  const updateNodes = (nodes: Node[], deltaTime: number, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;

    nodes.forEach(node => {
      if (node.type === 'master') {
        // Pulsing effect
        node.pulsePhase! += deltaTime * 0.002;
      } else if (node.type === 'worker') {
        // Orbital movement
        node.angle! += deltaTime * 0.001 * node.orbitSpeed!;
        node.x = centerX + Math.cos(node.angle!) * node.orbitRadius!;
        node.y = centerY + Math.sin(node.angle!) * node.orbitRadius!;
        node.pulsePhase! += deltaTime * 0.003;
      } else if (node.type === 'data') {
        // Random movement with boundaries
        node.x += node.vx * deltaTime * 0.1;
        node.y += node.vy * deltaTime * 0.1;

        // Bounce off edges
        if (node.x <= node.radius || node.x >= width - node.radius) {
          node.vx *= -1;
          node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
        }
        if (node.y <= node.radius || node.y >= height - node.radius) {
          node.vy *= -1;
          node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
        }

        // Slight direction changes
        if (Math.random() < 0.002) {
          node.vx += (Math.random() - 0.5) * 0.1;
          node.vy += (Math.random() - 0.5) * 0.1;
          
          // Limit speed
          const speed = Math.hypot(node.vx, node.vy);
          if (speed > 1) {
            node.vx = (node.vx / speed) * 1;
            node.vy = (node.vy / speed) * 1;
          }
        }

        node.pulsePhase! += deltaTime * 0.004;
      }
    });
  };

  // Update particles
  const updateParticles = (connections: Connection[], deltaTime: number) => {
    connections.forEach(connection => {
      // Add new particles occasionally
      if (Math.random() < 0.01) {
        connection.particles.push({
          x: connection.from.x,
          y: connection.from.y,
          progress: 0,
          speed: 0.3 + Math.random() * 0.4,
          size: 2 + Math.random() * 2
        });
      }

      // Update existing particles
      connection.particles = connection.particles.filter(particle => {
        particle.progress += particle.speed * deltaTime * 0.001;
        
        if (particle.progress >= 1) {
          return false; // Remove completed particles
        }

        // Interpolate position
        particle.x = connection.from.x + (connection.to.x - connection.from.x) * particle.progress;
        particle.y = connection.from.y + (connection.to.y - connection.from.y) * particle.progress;
        
        return true;
      });
    });
  };

  // Update AI symbols
  const updateAISymbols = (symbols: AISymbol[], deltaTime: number, width: number, height: number) => {
    symbols.forEach(symbol => {
      // Update position
      symbol.x += symbol.vx * deltaTime * 0.1;
      symbol.y += symbol.vy * deltaTime * 0.1;

      // Update rotation
      symbol.rotation += symbol.rotationSpeed * deltaTime;

      // Bounce off edges
      if (symbol.x <= 0 || symbol.x >= width) {
        symbol.vx *= -1;
        symbol.x = Math.max(0, Math.min(width, symbol.x));
      }
      if (symbol.y <= 0 || symbol.y >= height) {
        symbol.vy *= -1;
        symbol.y = Math.max(0, Math.min(height, symbol.y));
      }

      // Slight opacity animation
      if (symbol.type === 'binary' || symbol.type === 'text') {
        symbol.opacity += Math.sin(Date.now() * 0.001 + symbol.x * 0.01) * 0.001;
        symbol.opacity = Math.max(0.1, Math.min(0.7, symbol.opacity));
      }
    });
  };

  // Draw database icon
  const drawDatabaseIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    const width = size * 1.2;
    const height = size * 1.4;
    const ellipseHeight = size * 0.3;

    // Database cylinder body
    ctx.beginPath();
    ctx.rect(x - width/2, y - height/2 + ellipseHeight/2, width, height - ellipseHeight);
    ctx.fill();

    // Top ellipse
    ctx.beginPath();
    ctx.ellipse(x, y - height/2 + ellipseHeight/2, width/2, ellipseHeight/2, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Bottom ellipse
    ctx.beginPath();
    ctx.ellipse(x, y + height/2 - ellipseHeight/2, width/2, ellipseHeight/2, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Middle ellipse (for 3D effect)
    ctx.globalAlpha = alpha * 0.7;
    ctx.beginPath();
    ctx.ellipse(x, y, width/2, ellipseHeight/2, 0, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();
  };

  // Draw database logos
  const drawDatabaseLogo = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, logoType: string, alpha: number = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;

    const logoImage = logoImagesRef.current[logoType];
    
    if (logoImage) {
      // Special handling for MSSQL to make it red
      if (logoType === 'mssql') {
        // Create a temporary canvas to modify the logo color
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCanvas.width = size;
        tempCanvas.height = size;
        
        // Draw original logo
        tempCtx.drawImage(logoImage, 0, 0, size, size);
        
        // Apply red color filter
        tempCtx.globalCompositeOperation = 'source-atop';
        tempCtx.fillStyle = '#CC2927';
        tempCtx.fillRect(0, 0, size, size);
        
        // Draw the modified logo
        ctx.drawImage(tempCanvas, x - size / 2, y - size / 2);
      } else {
        // Draw other logos normally
        ctx.drawImage(
          logoImage,
          x - size / 2,
          y - size / 2,
          size,
          size
        );
      }
    } else {
      // Fallback to simple text if image not loaded
      ctx.translate(x, y);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 2;
      ctx.font = `bold ${size * 0.4}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const text = logoType.toUpperCase().substring(0, 3);
      ctx.strokeText(text, 0, 0);
      ctx.fillText(text, 0, 0);
    }

    ctx.restore();
  };

  // Render function
  const render = (ctx: CanvasRenderingContext2D, nodes: Node[], connections: Connection[], aiSymbols: AISymbol[]) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw nodes as database icons
    nodes.forEach(node => {
      let size = node.radius;
      let alpha = 0.8;

      if (node.type === 'master') {
        // Breathing effect
        const pulse = Math.sin(node.pulsePhase!) * 0.3 + 1;
        size *= pulse;
        alpha = 0.9;
        
        // Glow effect
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 25;
      } else if (node.type === 'worker') {
        const pulse = Math.sin(node.pulsePhase!) * 0.2 + 1;
        size *= pulse;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 15;
      } else {
        const pulse = Math.sin(node.pulsePhase!) * 0.1 + 1;
        size *= pulse;
        ctx.shadowBlur = 8;
      }

      // Draw database icon instead of circle
      drawDatabaseIcon(ctx, node.x, node.y, size, node.color, alpha);
      
      // Reset shadow
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });

    // Draw AI symbols
    aiSymbols.forEach(symbol => {
      ctx.save();
      ctx.translate(symbol.x, symbol.y);
      ctx.rotate(symbol.rotation);
      ctx.globalAlpha = symbol.opacity;

      if (symbol.type === 'binary') {
        ctx.fillStyle = colors.aiSymbol;
        ctx.font = `${symbol.size}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol.content, 0, 0);
      } else if (symbol.type === 'text') {
        ctx.fillStyle = colors.aiText;
        ctx.font = `bold ${symbol.size}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol.content, 0, 0);
      } else if (symbol.type === 'chip') {
        ctx.font = `${symbol.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol.content, 0, 0);
      } else if (symbol.type === 'neural') {
        ctx.fillStyle = colors.aiSymbol;
        ctx.font = `${symbol.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol.content, 0, 0);
      } else if (symbol.type === 'database') {
        // Draw small database icon
        ctx.globalAlpha = symbol.opacity;
        drawDatabaseIcon(ctx, 0, 0, symbol.size, colors.data, 1);
      } else if (symbol.type === 'dblogo') {
        // Draw database logo
        drawDatabaseLogo(ctx, 0, 0, symbol.size, symbol.logoType!, symbol.opacity);
      }

      ctx.restore();
    });
  };

  // Animation loop
  const animate = (currentTime: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!canvas || !ctx || nodesRef.current.length === 0) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const deltaTime = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;

    updateNodes(nodesRef.current, deltaTime, canvas.width, canvas.height);
    updateAISymbols(aiSymbolsRef.current, deltaTime, canvas.width, canvas.height);
    render(ctx, nodesRef.current, connectionsRef.current, aiSymbolsRef.current);

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Handle resize
  const handleResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    setDimensions({ width: rect.width, height: rect.height });
  };

  // Initialize when dimensions change
  useEffect(() => {
    if (dimensions.width && dimensions.height) {
      nodesRef.current = initializeNodes(dimensions.width, dimensions.height);
      connectionsRef.current = initializeConnections(nodesRef.current);
      aiSymbolsRef.current = initializeAISymbols(dimensions.width, dimensions.height);
    }
  }, [dimensions]);

  // Setup canvas and start animation
  useEffect(() => {
    // Load database logos
    loadDatabaseLogos();
    
    const timer = setTimeout(() => {
      handleResize();
      window.addEventListener('resize', handleResize);

      // Start animation
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(animate);
    }, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        opacity: 0.8,
        pointerEvents: 'none'
      }}
    />
  );
};

export default AINetworkBackground; 