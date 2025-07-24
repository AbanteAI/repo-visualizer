import React, { useState, useRef, useEffect, useCallback, ReactNode } from 'react';

interface FloatingMenuProps {
  title: string;
  titleColor?: string;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
  resizable?: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({
  title,
  titleColor = 'blue-500',
  initialPosition = { x: 20, y: 20 },
  initialSize = { width: 320, height: 400 },
  minSize = { width: 250, height: 200 },
  maxSize = { width: 600, height: 800 },
  resizable = true,
  onClose,
  children,
  className = '',
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ mouseX: 0, mouseY: 0, elementX: 0, elementY: 0 });
  const [resizeStart, setResizeStart] = useState({ mouseX: 0, mouseY: 0, width: 0, height: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Initialize position
  useEffect(() => {
    const initializePosition = () => {
      if (menuRef.current) {
        setPosition(initialPosition);
        setIsInitialized(true);
      }
    };

    if (!isInitialized) {
      initializePosition();
      if (!isInitialized) {
        setTimeout(initializePosition, 100);
      }
    }
  }, [isInitialized, initialPosition]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!menuRef.current) return;

    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'LABEL' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'OPTION' ||
      target.closest('input, label, button, select') ||
      target.classList.contains('resize-handle')
    ) {
      return;
    }

    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      elementX: position.x,
      elementY: position.y,
    });
    setIsDragging(true);
    e.preventDefault();
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    setResizeStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      width: size.width,
      height: size.height,
    });
    setIsResizing(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && menuRef.current) {
        const parent = menuRef.current.parentElement;
        if (!parent) return;

        const deltaX = e.clientX - dragStart.mouseX;
        const deltaY = e.clientY - dragStart.mouseY;

        const newX = dragStart.elementX + deltaX;
        const newY = dragStart.elementY + deltaY;

        const maxX = Math.max(0, parent.offsetWidth - size.width);
        const maxY = Math.max(0, window.innerHeight - size.height - 40);

        setPosition({
          x: Math.max(0, Math.min(maxX, newX)),
          y: Math.max(0, Math.min(maxY, newY)),
        });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.mouseX;
        const deltaY = e.clientY - resizeStart.mouseY;

        const newWidth = Math.max(
          minSize.width,
          Math.min(maxSize.width, resizeStart.width + deltaX)
        );
        const newHeight = Math.max(
          minSize.height,
          Math.min(maxSize.height, resizeStart.height + deltaY)
        );

        setSize({ width: newWidth, height: newHeight });
      }
    },
    [isDragging, isResizing, dragStart, resizeStart, size.width, size.height, minSize, maxSize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  // Handle window resize to keep menu visible
  useEffect(() => {
    const handleResize = () => {
      if (menuRef.current && isInitialized) {
        const parent = menuRef.current.parentElement;
        if (parent) {
          const maxX = Math.max(0, parent.offsetWidth - size.width);
          const maxY = Math.max(0, window.innerHeight - size.height - 40);

          setPosition(prev => ({
            x: Math.max(0, Math.min(maxX, prev.x)),
            y: Math.max(0, Math.min(maxY, prev.y)),
          }));
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isInitialized, size.width, size.height]);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={menuRef}
      className={`absolute transition-all duration-200 ${className}`}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: isInitialized ? position.x : initialPosition.x,
        top: isInitialized ? position.y : initialPosition.y,
        width: size.width,
        height: size.height,
        pointerEvents: 'auto',
        transform: 'translate3d(0, 0, 0)',
        zIndex: 1000,
        userSelect: 'none',
        backgroundColor: 'white',
        border: '2px solid #e5e7eb',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Close button positioned absolutely in top right */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-red-50 border border-gray-200 text-gray-400 hover:text-red-500 transition-all duration-200 shadow-sm hover:shadow-md z-10"
        style={{ cursor: 'pointer' }}
        aria-label="Close"
      >
        <span className="text-lg font-bold">×</span>
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pr-12" style={{ padding: '20px 20px 0 20px' }}>
        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <h3
          className="text-xl font-bold text-gray-900 border-b-2 pb-1"
          style={{
            borderBottomColor: (() => {
              switch (titleColor) {
                case 'blue-500':
                  return '#3b82f6';
                case 'indigo-500':
                  return '#6366f1';
                case 'purple-500':
                  return '#a855f7';
                case 'green-500':
                  return '#22c55e';
                case 'red-500':
                  return '#ef4444';
                case 'yellow-500':
                  return '#eab308';
                default:
                  return '#6b7280';
              }
            })(),
          }}
        >
          {title}
        </h3>
      </div>

      {/* Content with scroll */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-5"
        style={{
          maxHeight: `${Math.max(0, size.height - 80)}px`, // Account for header height, prevent negative values
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent',
        }}
      >
        {children}
      </div>

      {/* Resize handle - only show if resizable */}
      {resizable && (
        <div
          className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-50 hover:opacity-100 transition-opacity"
          onMouseDown={handleResizeMouseDown}
          style={{
            background:
              'linear-gradient(-45deg, transparent 30%, #9ca3af 30%, #9ca3af 40%, transparent 40%, transparent 60%, #9ca3af 60%, #9ca3af 70%, transparent 70%)',
          }}
        />
      )}
    </div>
  );
};

export default FloatingMenu;
