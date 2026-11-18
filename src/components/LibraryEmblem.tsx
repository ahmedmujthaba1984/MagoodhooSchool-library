import React from 'react';

interface LibraryEmblemProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LibraryEmblem: React.FC<LibraryEmblemProps> = ({
  size = 'md',
  className = '',
}) => {
  const dimensions =
    size === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : size === 'lg'
      ? 'w-12 h-12 rounded-2xl'
      : 'w-9 h-9 rounded-xl';

  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 26 : 22;

  return (
    <span
      className={`inline-flex items-center justify-center bg-[#0F4C45] text-[#F7F5F0] shadow-xs border border-[#16655B]/60 shrink-0 ${dimensions} ${className}`}
      aria-hidden="true"
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Open Book Silhouette */}
        <path
          d="M5 10.5C5 8.84 6.34 7.5 8 7.5H13.5C14.88 7.5 16 8.62 16 10V24.5C16 23.4 15.1 22.5 14 22.5H8C6.34 22.5 5 21.16 5 19.5V10.5Z"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinejoin="round"
        />
        <path
          d="M27 10.5C27 8.84 25.66 7.5 24 7.5H18.5C17.12 7.5 16 8.62 16 10V24.5C16 23.4 16.9 22.5 18 22.5H24C25.66 22.5 27 21.16 27 19.5V10.5Z"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinejoin="round"
        />
        {/* Warm Bookmark Ribbon */}
        <path
          d="M19.5 7.5V15.5L21.75 13.7L24 15.5V7.5"
          fill="#C26D3A"
        />
        {/* Maldivian Arch / Horizon Wave */}
        <path
          d="M7.5 26.75C10.5 24.9 13.5 24.9 16 26.75C18.5 24.9 21.5 24.9 24.5 26.75"
          stroke="#C26D3A"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
};
