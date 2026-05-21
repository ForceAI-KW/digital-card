'use client';
import { useState } from 'react';
import Image from 'next/image';

type Props = {
  src: string;
  alt: string;
  size: number;
  rounded?: 'full' | 'rounded';
};

export function Photo({ src, alt, size, rounded = 'full' }: Props) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ opacity: 0.4 }}
      >
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`w-full h-full object-cover${rounded === 'full' ? ' rounded-full' : ''}`}
      onError={() => setErrored(true)}
      priority
    />
  );
}
