type Props = { size?: number; color?: string; className?: string };

// Placeholder F-mark — minimalist sharp triangular F. Swap with the real
// Force falcon-F SVG once Ahmad supplies it under public/brand/falcon-f.svg.
export function FalconF({ size = 28, color = '#FF7700', className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6 4 L26 4 L20 12 L12 12 L12 18 L22 18 L18 24 L12 24 L12 28 L6 28 Z"
        fill={color}
      />
    </svg>
  );
}
