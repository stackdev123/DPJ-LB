
import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => {
  // Menggunakan file gambar dari folder public.
  // Pastikan file 'logo.png' sudah ada di folder public Anda.
  return (
    <img
      src="/logo.png"
      alt="Logo CV DPJ"
      className={`object-contain ${className}`}
    />
  );
};

export default Logo;
