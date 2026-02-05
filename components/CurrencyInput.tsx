import React, { useState, useEffect } from 'react';

interface CurrencyInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  name?: string;
  labelClassName?: string;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({ 
  label, 
  value, 
  onChange, 
  className, 
  placeholder, 
  required, 
  name, 
  labelClassName 
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value === 0) {
        setDisplayValue('');
    } else {
        setDisplayValue(value.toLocaleString('id-ID'));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    const numericValue = rawValue === '' ? 0 : parseInt(rawValue, 10);
    onChange(numericValue);
  };

  return (
    <div className="w-full">
      {label && <label className={labelClassName || "block text-sm font-medium text-slate-700 mb-1"}>{label}</label>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold pointer-events-none">Rp</span>
        <input
          type="text"
          name={name}
          className={`${className} pl-9`}
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
        />
      </div>
    </div>
  );
};

export default CurrencyInput;