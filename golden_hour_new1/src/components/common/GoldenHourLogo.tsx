import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const GoldenHourLogo: React.FC<LogoProps> = ({ className = 'w-7 h-7', size = 28 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Golden Hour Emergency Logo"
    >
      {/* Outer rounded protective badge */}
      <rect x="2" y="2" width="28" height="28" rx="8" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="2" />
      {/* Golden Clock / Hour ring */}
      <circle cx="16" cy="16" r="9" stroke="#D97706" strokeWidth="1.8" strokeDasharray="1.5 2" />
      {/* Red Cross Symbol in Center */}
      <path
        d="M16 10V22M10 16H22"
        stroke="#E11D48"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Hourglass needle indicator */}
      <path
        d="M16 11L18.5 16H13.5L16 11Z"
        fill="#F59E0B"
      />
      <circle cx="16" cy="16" r="1.5" fill="#B45309" />
    </svg>
  );
};
