import { useState, useRef, useEffect, useCallback } from 'react';

interface UseDraggableProps {
  initialPosition: { x: number | string; y: number | string };
  width: number;
}

export const useDraggable = ({ initialPosition, width }: UseDraggableProps) => {
  const [position, setPosition] = useState({ x: 0, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ mouseX: 0, mouseY: 0, elementX: 0, elementY: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  // Initialize position
  useEffect(() => {
    const initializePosition = () => {
      if (controlsRef.current) {
        const parent = controlsRef.current.parentElement;
        if (parent) {
          let x: number;
          let y: number;

          if (typeof initialPosition.x === 'string') {
            if (initialPosition.x.includes('calc(')) {
              // Handle calc expressions like 'calc(100% - 300px)'
              const parentWidth = parent.offsetWidth;
              x = Math.max(0, parentWidth - width - 20);
            } else {
              x = parseInt(initialPosition.x) || 0;
            }
          } else {
            x = initialPosition.x;
          }

          if (typeof initialPosition.y === 'string') {
            y = parseInt(initialPosition.y) || 20;
          } else {
            y = initialPosition.y;
          }

          setPosition({ x, y });
          setIsInitialized(true);
        }
      }
    };

    if (!isInitialized) {
      initializePosition();
      if (!isInitialized) {
        setTimeout(initializePosition, 100);
      }
    }
  }, [isInitialized, initialPosition, width]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!controlsRef.current) return;

    // Don't start dragging if clicking on input elements, labels, or close button
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'LABEL' ||
      target.tagName === 'BUTTON' ||
      target.closest('input, label, button')
    ) {
      return;
    }

    // Store initial positions
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      elementX: position.x,
      elementY: position.y,
    });

    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !controlsRef.current) return;

      const parent = controlsRef.current.parentElement;
      if (!parent) return;

      // Calculate how much the mouse has moved since drag started
      const deltaX = e.clientX - dragStart.mouseX;
      const deltaY = e.clientY - dragStart.mouseY;

      // Calculate new position
      const newX = dragStart.elementX + deltaX;
      const newY = dragStart.elementY + deltaY;

      // Keep within bounds - use window dimensions for better movement freedom
      const maxX = Math.max(0, parent.offsetWidth - controlsRef.current.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - controlsRef.current.offsetHeight - 40); // 40px buffer from bottom

      setPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY)),
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle window resize to keep panel visible
  useEffect(() => {
    const handleResize = () => {
      if (controlsRef.current && isInitialized) {
        const parent = controlsRef.current.parentElement;
        if (parent) {
          const maxX = Math.max(0, parent.offsetWidth - controlsRef.current.offsetWidth);
          const maxY = Math.max(0, window.innerHeight - controlsRef.current.offsetHeight - 40);

          setPosition(prev => ({
            x: Math.max(0, Math.min(maxX, prev.x)),
            y: Math.max(0, Math.min(maxY, prev.y)),
          }));
        }
      }
    };

    if (isInitialized) {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [isInitialized]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return {
    position,
    isDragging,
    isInitialized,
    controlsRef,
    handleMouseDown,
  };
};
