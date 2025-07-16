import React, { useState, useRef, useEffect } from 'react';

interface MenuDropdownProps {
  showConnectionWeights: boolean;
  showNodeSizing: boolean;
  onOpenConnectionWeights: () => void;
  onOpenNodeSizing: () => void;
}

const MenuDropdown: React.FC<MenuDropdownProps> = ({
  showConnectionWeights,
  showNodeSizing,
  onOpenConnectionWeights,
  onOpenNodeSizing,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasHiddenMenus = !showConnectionWeights || !showNodeSizing;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Don't render if no menus are hidden
  if (!hasHiddenMenus) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-200 text-gray-600 hover:text-gray-800"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
            Show Menus
          </div>

          {!showConnectionWeights && (
            <button
              onClick={() => {
                onOpenConnectionWeights();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 flex items-center gap-3"
            >
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
              Connection Weights
            </button>
          )}

          {!showNodeSizing && (
            <button
              onClick={() => {
                onOpenNodeSizing();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 flex items-center gap-3"
            >
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
              </div>
              Node Sizing
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MenuDropdown;
