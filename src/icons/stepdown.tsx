import React from 'react';

interface IconProps {
    size?: string;
    color?: string;
}

const IconStepdown: React.FC<IconProps> = ({ size = "32", color = "#4FAA41" }) => (
    <svg width={size} height={size}  viewBox="0 0 48 48" fill={color} xmlns="http://www.w3.org/2000/svg">
        <rect width={size} height={size} fill={color} fillOpacity="0.01" />
        <path d="M42 19H5.99998" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M30 7L42 19" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.79897 29H42.799" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.79895 29L18.799 41" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>

);


export default IconStepdown;