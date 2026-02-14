import Link from 'next/link';

interface LogoProps {
  variant?: 'horizontal' | 'stacked' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

function PawIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="24" cy="24" r="24" fill="#ED7410" />
      <g fill="white">
        {/* Main pad */}
        <ellipse cx="24" cy="29" rx="8" ry="6.5" />
        {/* Top left toe */}
        <ellipse cx="15" cy="19" rx="3.5" ry="4.5" transform="rotate(-15 15 19)" />
        {/* Top right toe */}
        <ellipse cx="33" cy="19" rx="3.5" ry="4.5" transform="rotate(15 33 19)" />
        {/* Middle left toe */}
        <ellipse cx="18.5" cy="14" rx="3" ry="4" transform="rotate(-5 18.5 14)" />
        {/* Middle right toe */}
        <ellipse cx="29.5" cy="14" rx="3" ry="4" transform="rotate(5 29.5 14)" />
      </g>
    </svg>
  );
}

const SIZES = {
  sm: { icon: 'w-7 h-7', text: 'text-lg', tagline: 'text-[8px]' },
  md: { icon: 'w-9 h-9', text: 'text-xl', tagline: 'text-[9px]' },
  lg: { icon: 'w-12 h-12', text: 'text-2xl', tagline: 'text-[10px]' },
};

export function Logo({ variant = 'horizontal', size = 'md', showTagline = false, className = '' }: LogoProps) {
  const s = SIZES[size];

  if (variant === 'icon') {
    return <PawIcon className={s.icon} />;
  }

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center gap-1 ${className}`}>
        <PawIcon className={s.icon} />
        <div className="text-center">
          <span className={`${s.text} font-bold tracking-tight`}>
            <span className="text-[#1A1A2E]">Paw</span>
            <span className="text-[#ED7410]">Cities</span>
          </span>
          {showTagline && (
            <p className={`${s.tagline} font-semibold tracking-[0.2em] text-gray-500 uppercase mt-0.5`}>
              Dog Friendly Places Worldwide
            </p>
          )}
        </div>
      </div>
    );
  }

  // Horizontal (default) - used in navbar
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <PawIcon className={s.icon} />
      <div className="flex flex-col">
        <span className={`${s.text} font-bold tracking-tight leading-tight`}>
          <span className="text-[#1A1A2E]">Paw</span>
          <span className="text-[#ED7410]">Cities</span>
        </span>
        {showTagline && (
          <span className={`${s.tagline} font-semibold tracking-[0.15em] text-gray-500 uppercase leading-tight`}>
            Dog Friendly Places Worldwide
          </span>
        )}
      </div>
    </div>
  );
}

// Clickable logo that links to homepage
export function LogoLink({ variant = 'horizontal', size = 'md', showTagline = false, className = '' }: LogoProps) {
  return (
    <Link href="/" className={`inline-flex hover:opacity-90 transition-opacity ${className}`}>
      <Logo variant={variant} size={size} showTagline={showTagline} />
    </Link>
  );
}

export { PawIcon };
