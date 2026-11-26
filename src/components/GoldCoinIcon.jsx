import { useId } from 'react';

/**
 * Glossy shining gold coin SVG symbol replacing OS-dependent silver coin emojis.
 */
const GoldCoinIcon = ({ size = 16, className = '' }) => {
  const uid = useId().replace(/:/g, '');
  const rimGradId = `goldRim_${uid}`;
  const faceGradId = `goldFace_${uid}`;
  const shineGradId = `goldShine_${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block align-middle shrink-0 drop-shadow-[0_1px_4px_rgba(245,158,11,0.55)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={rimGradId} x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF7B2" />
          <stop offset="35%" stopColor="#FBBF24" />
          <stop offset="75%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
        <radialGradient id={faceGradId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="45%" stopColor="#FACC15" />
          <stop offset="85%" stopColor="#EAB308" />
          <stop offset="100%" stopColor="#B45309" />
        </radialGradient>
        <linearGradient id={shineGradId} x1="6" y1="6" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Outer gold coin body & beveled rim */}
      <circle cx="16" cy="16" r="14.5" fill={`url(#${rimGradId})`} stroke="#92400E" strokeWidth="0.8" />
      {/* Inner recessed shiny face */}
      <circle cx="16" cy="16" r="11.4" fill={`url(#${faceGradId})`} stroke="#FEF3C7" strokeWidth="0.9" strokeOpacity="0.85" />
      {/* Stamped inner mint ring */}
      <circle cx="16" cy="16" r="9" fill="none" stroke="#B45309" strokeWidth="0.9" strokeOpacity="0.45" strokeDasharray="2 1.2" />
      {/* Center embossed star/emblem */}
      <path
        d="M16 9.5L17.9 13.4L22.2 14L19.1 17L19.8 21.3L16 19.3L12.2 21.3L12.9 17L9.8 14L14.1 13.4L16 9.5Z"
        fill="#FEF9C3"
        stroke="#B45309"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      {/* Top-left glossy specular sweep */}
      <path d="M7.5 11.5C9.4 7.5 13.2 5.4 17.6 5.6C13.6 7.1 10.1 10.6 8.3 15.2C7.4 14 7.1 12.7 7.5 11.5Z" fill={`url(#${shineGradId})`} />
      {/* Top-right shining sparkle */}
      <path d="M24.2 5.2L24.9 7.1L26.8 7.8L24.9 8.5L24.2 10.4L23.5 8.5L21.6 7.8L23.5 7.1L24.2 5.2Z" fill="#FFFBEB" />
    </svg>
  );
};

export const getGoldCoinHtml = (size = 16) => (
  `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0;filter:drop-shadow(0 1px 4px rgba(245,158,11,0.55));">
    <defs>
      <linearGradient id="gcRim" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#FFF7B2"/><stop offset="35%" stop-color="#FBBF24"/><stop offset="75%" stop-color="#D97706"/><stop offset="100%" stop-color="#92400E"/>
      </linearGradient>
      <radialGradient id="gcFace" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#FEF08A"/><stop offset="45%" stop-color="#FACC15"/><stop offset="85%" stop-color="#EAB308"/><stop offset="100%" stop-color="#B45309"/>
      </radialGradient>
    </defs>
    <circle cx="16" cy="16" r="14.5" fill="url(#gcRim)" stroke="#92400E" stroke-width="0.8"/>
    <circle cx="16" cy="16" r="11.4" fill="url(#gcFace)" stroke="#FEF3C7" stroke-width="0.9" stroke-opacity="0.85"/>
    <circle cx="16" cy="16" r="9" fill="none" stroke="#B45309" stroke-width="0.9" stroke-opacity="0.45" stroke-dasharray="2 1.2"/>
    <path d="M16 9.5L17.9 13.4L22.2 14L19.1 17L19.8 21.3L16 19.3L12.2 21.3L12.9 17L9.8 14L14.1 13.4L16 9.5Z" fill="#FEF9C3" stroke="#B45309" stroke-width="0.7" stroke-linejoin="round"/>
    <path d="M24.2 5.2L24.9 7.1L26.8 7.8L24.9 8.5L24.2 10.4L23.5 8.5L21.6 7.8L23.5 7.1L24.2 5.2Z" fill="#FFFBEB"/>
  </svg>`
);

export default GoldCoinIcon;
