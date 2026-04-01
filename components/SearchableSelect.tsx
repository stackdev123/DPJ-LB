import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  allowNew?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
  label, 
  value, 
  onChange, 
  options, 
  placeholder,
  required,
  allowNew = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If external value changes, sync internal search only if it doesn't match
    // This allows typing freely
    if (value) setSearch(value);
  }, [value]);

  useEffect(() => {
    // Close dropdown when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (!allowNew) {
          const match = options.find(opt => opt.toLowerCase() === search.toLowerCase());
          if (!match && search !== '') {
            setSearch('');
            onChange('');
          } else if (match && match !== search) {
            setSearch(match);
            onChange(match);
          }
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, allowNew, options, search, onChange]);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (opt: string) => {
    setSearch(opt);
    onChange(opt);
    setIsOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    onChange(e.target.value);
    setIsOpen(true);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          className="block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 p-2 border pr-10"
          placeholder={placeholder}
          value={search}
          onChange={handleChange}
          onFocus={() => setIsOpen(true)}
          required={required}
        />
        <div 
            className="absolute right-2 top-2.5 text-slate-400 cursor-pointer"
            onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronDown className="w-5 h-5" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <div
                key={idx}
                className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 flex justify-between items-center"
                onClick={() => handleSelect(opt)}
              >
                {opt}
                {value === opt && <Check className="w-4 h-4 text-primary" />}
              </div>
            ))
          ) : (
             <div className="px-4 py-2 text-sm text-slate-500 italic">
               {allowNew ? `"${search}" (New Entry)` : "Data tidak ditemukan"}
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;