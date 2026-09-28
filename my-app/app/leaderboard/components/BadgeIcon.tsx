"use client";

import React from "react";

interface BadgeIconProps {
  badgeKey?: string;
  size?: number;
  className?: string;
  isUnlocked?: boolean;
}

export const BadgeIcon: React.FC<BadgeIconProps> = ({
  badgeKey = "rookie",
  size = 48,
  className = "",
  isUnlocked = true,
}) => {
  const key = (badgeKey || "rookie").toLowerCase();

  const filterStyle = !isUnlocked
    ? { filter: "grayscale(100%) opacity(40%)" }
    : undefined;

  const renderIcon = () => {
    switch (key) {
      case "rookie":
        // Dark medallion with fresh green sprout
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} style={filterStyle} className={className}>
            <defs>
              <radialGradient id="rookieBg" cx="50%" cy="45%" r="55%">
                <stop offset="0%" stopColor="#2A302D" />
                <stop offset="85%" stopColor="#141816" />
                <stop offset="100%" stopColor="#0B0E0D" />
              </radialGradient>
              <linearGradient id="rookieRim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#526058" />
                <stop offset="50%" stopColor="#2D3732" />
                <stop offset="100%" stopColor="#1A201D" />
              </linearGradient>
              <linearGradient id="leafGradLeft" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#16A34A" />
                <stop offset="50%" stopColor="#22C55E" />
                <stop offset="100%" stopColor="#86EFAC" />
              </linearGradient>
              <linearGradient id="leafGradRight" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#15803D" />
                <stop offset="60%" stopColor="#22C55E" />
                <stop offset="100%" stopColor="#4ADE80" />
              </linearGradient>
            </defs>
            {/* Outer Rim */}
            <circle cx="50" cy="50" r="47" fill="url(#rookieRim)" stroke="#3E4A43" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="43" fill="url(#rookieBg)" />
            {/* Subtle Inner Glow */}
            <circle cx="50" cy="50" r="41" fill="none" stroke="#22C55E" strokeWidth="0.8" opacity="0.25" strokeDasharray="3 2" />
            {/* Earth Mound */}
            <ellipse cx="50" cy="74" rx="22" ry="7" fill="#382417" opacity="0.9" />
            <ellipse cx="50" cy="73" rx="16" ry="4" fill="#523624" opacity="0.7" />
            {/* Sprout Stem */}
            <path d="M50 73 Q49.5 58 50 43" stroke="#15803D" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            {/* Left Leaf */}
            <path d="M50 54 C40 44 28 48 30 60 C36 65 48 60 50 54 Z" fill="url(#leafGradLeft)" />
            <path d="M33 55 Q42 54 50 54" stroke="#86EFAC" strokeWidth="0.8" fill="none" opacity="0.6" />
            {/* Right Leaf */}
            <path d="M50 46 C60 36 72 40 70 52 C64 57 52 52 50 46 Z" fill="url(#leafGradRight)" />
            <path d="M50 46 Q58 46 67 47" stroke="#BBF7D0" strokeWidth="0.8" fill="none" opacity="0.6" />
          </svg>
        );

      case "explorer":
        // Dark medallion with nautical compass star in cyan/teal
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} style={filterStyle} className={className}>
            <defs>
              <radialGradient id="explorerBg" cx="50%" cy="45%" r="55%">
                <stop offset="0%" stopColor="#1E293B" />
                <stop offset="85%" stopColor="#0F172A" />
                <stop offset="100%" stopColor="#020617" />
              </radialGradient>
              <linearGradient id="compassTeal" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="50%" stopColor="#00B0ED" />
                <stop offset="100%" stopColor="#0369A1" />
              </linearGradient>
            </defs>
            {/* Outer Rim */}
            <circle cx="50" cy="50" r="47" fill="#0F172A" stroke="url(#compassTeal)" strokeWidth="3" />
            <circle cx="50" cy="50" r="42" fill="url(#explorerBg)" />
            {/* Compass Ticks */}
            <circle cx="50" cy="50" r="38" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="2 4" />
            {/* Minor Diagonal Star Points */}
            <polygon points="50,50 42,42 50,30 58,42" fill="#0369A1" opacity="0.8" />
            <polygon points="50,50 58,42 70,50 58,58" fill="#0284C7" opacity="0.8" />
            <polygon points="50,50 58,58 50,70 42,58" fill="#0369A1" opacity="0.8" />
            <polygon points="50,50 42,58 30,50 42,42" fill="#0284C7" opacity="0.8" />
            {/* Major North-South-East-West Star */}
            {/* North Point */}
            <polygon points="50,16 50,50 45,50" fill="#38BDF8" />
            <polygon points="50,16 55,50 50,50" fill="#0284C7" />
            {/* South Point */}
            <polygon points="50,84 50,50 55,50" fill="#38BDF8" />
            <polygon points="50,84 45,50 50,50" fill="#0284C7" />
            {/* East Point */}
            <polygon points="84,50 50,50 50,45" fill="#38BDF8" />
            <polygon points="84,50 50,55 50,50" fill="#0284C7" />
            {/* West Point */}
            <polygon points="16,50 50,50 50,55" fill="#38BDF8" />
            <polygon points="16,50 50,45 50,50" fill="#0284C7" />
            {/* Center Rings */}
            <circle cx="50" cy="50" r="7" fill="#0F172A" stroke="url(#compassTeal)" strokeWidth="2" />
            <circle cx="50" cy="50" r="3" fill="#F8FAFC" />
          </svg>
        );

      case "creator":
        // Warm bronze/wood shield with crossed tools
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} style={filterStyle} className={className}>
            <defs>
              <linearGradient id="creatorShield" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A16207" />
                <stop offset="50%" stopColor="#713F12" />
                <stop offset="100%" stopColor="#451A03" />
              </linearGradient>
              <linearGradient id="toolGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>
            {/* Shield Body */}
            <polygon points="50,6 88,20 84,62 50,94 16,62 12,20" fill="url(#creatorShield)" stroke="#D97706" strokeWidth="3" />
            <polygon points="50,12 82,24 78,58 50,86 22,58 18,24" fill="#2E1004" opacity="0.75" />
            {/* Crossed Tools */}
            {/* Ruler */}
            <g transform="rotate(45 50 50)">
              <rect x="44" y="20" width="12" height="60" rx="3" fill="#EAB308" stroke="#713F12" strokeWidth="1.5" />
              <line x1="44" y1="30" x2="50" y2="30" stroke="#713F12" strokeWidth="1.5" />
              <line x1="44" y1="40" x2="52" y2="40" stroke="#713F12" strokeWidth="1.5" />
              <line x1="44" y1="50" x2="50" y2="50" stroke="#713F12" strokeWidth="1.5" />
              <line x1="44" y1="60" x2="52" y2="60" stroke="#713F12" strokeWidth="1.5" />
              <line x1="44" y1="70" x2="50" y2="70" stroke="#713F12" strokeWidth="1.5" />
            </g>
            {/* Pencil / Chisel */}
            <g transform="rotate(-45 50 50)">
              <rect x="46" y="22" width="8" height="48" rx="2" fill="#FEF08A" stroke="#B45309" strokeWidth="1" />
              <polygon points="45,70 55,70 50,82" fill="#D97706" />
              <polygon points="48,78 52,78 50,82" fill="#18181B" />
              <rect x="45" y="22" width="10" height="8" fill="#F87171" rx="1" />
            </g>
          </svg>
        );

      case "specialist":
        // Silver / Platinum hexagonal shield with 3D faceted cube
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} style={filterStyle} className={className}>
            <defs>
              <linearGradient id="specRim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E2E8F0" />
                <stop offset="50%" stopColor="#94A3B8" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
              <linearGradient id="specBg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1E293B" />
                <stop offset="100%" stopColor="#0F172A" />
              </linearGradient>
            </defs>
            {/* Hexagon Crest */}
            <polygon points="50,6 88,28 88,72 50,94 12,72 12,28" fill="url(#specBg)" stroke="url(#specRim)" strokeWidth="3.5" />
            <polygon points="50,12 82,31 82,69 50,88 18,69 18,31" fill="none" stroke="#64748B" strokeWidth="1" opacity="0.5" />
            {/* 3D Isometric Faceted Cube */}
            {/* Top Face */}
            <polygon points="50,26 70,38 50,50 30,38" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="0.8" />
            {/* Left Face */}
            <polygon points="30,38 50,50 50,74 30,62" fill="#94A3B8" stroke="#64748B" strokeWidth="0.8" />
            {/* Right Face */}
            <polygon points="70,38 50,50 50,74 70,62" fill="#64748B" stroke="#475569" strokeWidth="0.8" />
            {/* Highlight Star Sparkle */}
            <polygon points="50,44 52,48 56,50 52,52 50,56 48,52 44,50 48,48" fill="#FFFFFF" opacity="0.9" />
          </svg>
        );

      case "design_pro":
        // Golden crown inside dark shield with gold border
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} style={filterStyle} className={className}>
            <defs>
              <linearGradient id="goldProRim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="50%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#92400E" />
              </linearGradient>
              <linearGradient id="crownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="40%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
            </defs>
            {/* Shield Base */}
            <polygon points="50,6 88,22 84,64 50,94 16,64 12,22" fill="#1C1917" stroke="url(#goldProRim)" strokeWidth="3.5" />
            <polygon points="50,12 82,26 78,60 50,86 22,60 18,26" fill="#0C0A09" opacity="0.8" />
            {/* 5-Point Golden Crown */}
            <polygon points="26,66 74,66 80,42 62,52 50,30 38,52 20,42" fill="url(#crownGrad)" stroke="#FEF3C7" strokeWidth="1.2" />
            {/* Crown Base Band */}
            <rect x="26" y="62" width="48" height="5" rx="1.5" fill="#B45309" stroke="#FEF08A" strokeWidth="0.8" />
            {/* Center Crown Jewel */}
            <circle cx="50" cy="30" r="3" fill="#FEF08A" />
            <circle cx="20" cy="42" r="2.5" fill="#FEF08A" />
            <circle cx="80" cy="42" r="2.5" fill="#FEF08A" />
            <circle cx="38" cy="52" r="2" fill="#FEF08A" />
            <circle cx="62" cy="52" r="2" fill="#FEF08A" />
            <polygon points="50,44 53,51 50,57 47,51" fill="#FEF08A" />
          </svg>
        );

      case "design_master":
        // Faceted amethyst purple jewel shield
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} style={filterStyle} className={className}>
            <defs>
              <linearGradient id="purpleShieldRim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C084FC" />
                <stop offset="50%" stopColor="#9333EA" />
                <stop offset="100%" stopColor="#581C87" />
              </linearGradient>
              <linearGradient id="purpleGemTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E9D5FF" />
                <stop offset="100%" stopColor="#C084FC" />
              </linearGradient>
            </defs>
            {/* Outer Purple Crest */}
            <polygon points="50,6 88,26 86,72 50,94 14,72 12,26" fill="#1E1B4B" stroke="url(#purpleShieldRim)" strokeWidth="3.5" />
            {/* Faceted Amethyst Gem */}
            <polygon points="50,26 72,42 64,70 36,70 28,42" fill="#7E22CE" />
            <polygon points="50,26 72,42 50,50" fill="url(#purpleGemTop)" />
            <polygon points="50,26 28,42 50,50" fill="#D8B4FE" />
            <polygon points="28,42 36,70 50,50" fill="#6B21A8" />
            <polygon points="72,42 64,70 50,50" fill="#9333EA" />
            <polygon points="36,70 64,70 50,50" fill="#581C87" />
            {/* Gem Edge Highlight */}
            <polyline points="28,42 50,26 72,42" fill="none" stroke="#FAF5FF" strokeWidth="1.2" opacity="0.8" />
          </svg>
        );

      case "elite":
        // Winged Sapphire Blue Shield with Silver Star
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} style={filterStyle} className={className}>
            <defs>
              <linearGradient id="eliteBlueRim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="50%" stopColor="#00B0ED" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
              <linearGradient id="wingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#1E40AF" />
              </linearGradient>
            </defs>
            {/* Left Wings */}
            <path d="M12 28 C16 18 32 20 44 32 L36 48 L22 42 L12 28 Z" fill="url(#wingGrad)" opacity="0.85" />
            <path d="M14 42 C20 38 34 38 42 48 L32 60 L18 54 L14 42 Z" fill="#1D4ED8" opacity="0.8" />
            {/* Right Wings */}
            <path d="M88 28 C84 18 68 20 56 32 L64 48 L78 42 L88 28 Z" fill="url(#wingGrad)" opacity="0.85" />
            <path d="M86 42 C80 38 66 38 58 48 L68 60 L82 54 L86 42 Z" fill="#1D4ED8" opacity="0.8" />
            {/* Central Sapphire Crest */}
            <polygon points="50,12 78,26 72,66 50,92 28,66 22,26" fill="#0B132B" stroke="url(#eliteBlueRim)" strokeWidth="3" />
            <polygon points="50,18 72,30 68,62 50,84 32,62 28,30" fill="#0F172A" opacity="0.8" />
            {/* Silver / White 5-Point Center Star */}
            <polygon points="50,32 54,44 67,44 56,52 60,65 50,57 40,65 44,52 33,44 46,44" fill="#F8FAFC" stroke="#38BDF8" strokeWidth="1" />
          </svg>
        );

      case "legend":
      default:
        // Majestic Golden Winged Trophy & Laurel Crown
        return (
          <svg viewBox="0 0 100 100" width={size} height={size} style={filterStyle} className={className}>
            <defs>
              <linearGradient id="legendGoldRim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="50%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#92400E" />
              </linearGradient>
              <linearGradient id="legendGoldFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFBEB" />
                <stop offset="35%" stopColor="#FDE047" />
                <stop offset="70%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
            </defs>
            {/* Left Golden Wing */}
            <path d="M12 26 C16 16 32 18 44 32 L36 48 L22 42 L12 26 Z" fill="url(#legendGoldFill)" opacity="0.85" />
            <path d="M14 40 C20 36 34 36 42 46 L32 58 L18 52 L14 40 Z" fill="#D97706" opacity="0.8" />
            {/* Right Golden Wing */}
            <path d="M88 26 C84 16 68 18 56 32 L64 48 L78 42 L88 26 Z" fill="url(#legendGoldFill)" opacity="0.85" />
            <path d="M86 40 C80 36 66 36 58 46 L68 58 L82 52 L86 40 Z" fill="#D97706" opacity="0.8" />
            {/* Golden Crest Shield */}
            <polygon points="50,10 78,26 72,66 50,92 28,66 22,26" fill="#18181B" stroke="url(#legendGoldRim)" strokeWidth="3" />
            {/* Radiating Sunburst / Laurel */}
            <circle cx="50" cy="36" r="12" fill="url(#legendGoldFill)" stroke="#FEF08A" strokeWidth="1" />
            <polygon points="50,22 52,28 58,26 54,31 59,35 53,37 55,43 50,39 45,43 47,37 41,35 46,31 42,26 48,28" fill="#FEF9C3" />
            {/* Laurel Wreath */}
            <path d="M34 50 C34 64 42 74 50 78 C58 74 66 64 66 50" fill="none" stroke="url(#legendGoldRim)" strokeWidth="2.5" strokeLinecap="round" />
            {/* Golden Star Base */}
            <polygon points="50,60 53,67 60,67 55,71 57,78 50,73 43,78 45,71 40,67 47,67" fill="#FEF08A" />
          </svg>
        );
    }
  };

  return <div className="inline-flex items-center justify-center shrink-0">{renderIcon()}</div>;
};
