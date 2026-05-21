import type { CardSocials } from '@/data/cards/_types';

type Props = { socials: CardSocials; color: string };

// lucide-react v1.16.0 does not ship brand/social icons.
// All social icons are implemented as custom monoline SVGs.

function InstagramIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4.5" stroke={color} strokeWidth="1.5" />
      <circle cx="17.5" cy="6.5" r="1" fill={color} />
    </svg>
  );
}

function LinkedinIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="3" stroke={color} strokeWidth="1.5" />
      <line x1="8" y1="10" x2="8" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="7" x2="8" y2="7.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M12 17V13c0-1.657 1.343-3 3-3s3 1.343 3 3v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GithubIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function YoutubeIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="4" stroke={color} strokeWidth="1.5" />
      <polygon points="10,9 16,12 10,15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M17.53 3H20.5L13.93 10.49L21.66 21H15.62L10.86 14.59L5.46 21H2.49L9.49 12.99L2.08 3H8.28L12.55 8.84L17.53 3Z"
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  );
}

function TikTokIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V9.18a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.79 4.79 0 0 1-1.84-.61Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SocialIconRow({ socials, color }: Props) {
  const items: Array<{ href: string; label: string; icon: React.ReactNode }> = [];

  if (socials.instagram) items.push({
    href: `https://instagram.com/${socials.instagram}`,
    label: 'Instagram',
    icon: <InstagramIcon color={color} />,
  });
  if (socials.linkedin) items.push({
    href: `https://linkedin.com/in/${socials.linkedin}`,
    label: 'LinkedIn',
    icon: <LinkedinIcon color={color} />,
  });
  if (socials.x) items.push({
    href: `https://x.com/${socials.x}`,
    label: 'X',
    icon: <XIcon color={color} />,
  });
  if (socials.github) items.push({
    href: `https://github.com/${socials.github}`,
    label: 'GitHub',
    icon: <GithubIcon color={color} />,
  });
  if (socials.youtube) items.push({
    href: `https://youtube.com/@${socials.youtube}`,
    label: 'YouTube',
    icon: <YoutubeIcon color={color} />,
  });
  if (socials.tiktok) items.push({
    href: `https://tiktok.com/@${socials.tiktok}`,
    label: 'TikTok',
    icon: <TikTokIcon color={color} />,
  });

  if (items.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-7" role="list">
      {items.map((it) => (
        <a
          key={it.href}
          href={it.href}
          aria-label={it.label}
          target="_blank"
          rel="noopener noreferrer"
          role="listitem"
          className="transition-transform active:scale-95"
        >
          {it.icon}
        </a>
      ))}
    </div>
  );
}
