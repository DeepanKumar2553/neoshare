import React from 'react';

interface WifiConnectionUIProps {
  isWaiting: boolean;
}

export const WifiConnectionUI: React.FC<WifiConnectionUIProps> = ({ isWaiting }) => {
  return (
    <div className="flex flex-col items-center justify-center ml-17">
      {/* Fixed-size container for the symbol */}
      <div className="relative" style={{ width: '100px', height: '100px' }}>
        {/* Holographic effect only in waiting state */}
        {isWaiting && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="absolute w-full h-full rounded-full bg-cyan-500/10 blur-md"
              style={{ 
                animation: 'pulse 3s infinite',
                opacity: 0.5
              }}
            />
          </div>
        )}
        
        {/* Stable Wi-Fi Symbol */}
        <svg 
          width="100" 
          height="100" 
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          className="transition-all duration-300"
        >
          {/* Arc 1 (Largest) */}
          <path
            d="M10 50 A40 40 0 0 1 90 50"
            fill="none"
            stroke={isWaiting ? "#00f7ff" : "#4a5568"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={isWaiting ? "4,3" : "0"}
          />
          
          {/* Arc 2 */}
          <path
            d="M20 50 A30 30 0 0 1 80 50"
            fill="none"
            stroke={isWaiting ? "#00c6ff" : "#4a5568"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={isWaiting ? "4,3" : "0"}
          />
          
          {/* Arc 3 */}
          <path
            d="M30 50 A20 20 0 0 1 70 50"
            fill="none"
            stroke={isWaiting ? "#00a2ff" : "#4a5568"}
            strokeWidth="3"
            strokeLinecap="round"
          />
          
          {/* Center sphere */}
          <circle
            cx="50"
            cy="50"
            r="5"
            fill={isWaiting ? "#00c6ff" : "#4a5568"}
            style={isWaiting ? { 
              filter: 'drop-shadow(0 0 3px rgba(0, 199, 255, 0.8))',
              animation: 'pulse 1.5s infinite'
            } : {}}
          />
          
          {/* Connection lines - only in waiting state */}
          {isWaiting && (
            <>
              <line 
                x1="50" y1="50" x2="50" y2="35"
                stroke="#00f7ff"
                strokeWidth="1.5"
                strokeLinecap="round"
                style={{ 
                  animation: 'fade 1.5s infinite',
                  opacity: 0
                }}
              />
              <line 
                x1="50" y1="50" x2="65" y2="35"
                stroke="#00c6ff"
                strokeWidth="1.5"
                strokeLinecap="round"
                style={{ 
                  animation: 'fade 1.8s infinite 0.2s',
                  opacity: 0
                }}
              />
              <line 
                x1="50" y1="50" x2="35" y2="35"
                stroke="#00c6ff"
                strokeWidth="1.5"
                strokeLinecap="round"
                style={{ 
                  animation: 'fade 1.8s infinite 0.4s',
                  opacity: 0
                }}
              />
            </>
          )}
        </svg>
      </div>
      
      {/* Status text with fixed width */}
      <div className="w-48 text-center mt-2">
        <div className={`text-sm font-medium transition-all -mt-10 duration-300 ${
          isWaiting 
            ? 'text-cyan-400' 
            : 'text-gray-400'
        }`}>
          {isWaiting ? 'Waiting for connection...' : 'No device connected'}
        </div>
      </div>
    </div>
  );
};