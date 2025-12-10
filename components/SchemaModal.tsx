import React, { useState } from 'react';
import { X, Copy, Check, Database } from 'lucide-react';

interface SchemaModalProps {
  onClose: () => void;
}

const SchemaModal: React.FC<SchemaModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);

  const sqlContent = `-- Enable UUID extension (Recommended but not strictly required if using gen_random_uuid in PG13+)
create extension if not exists "uuid-ossp";

-- 1. Activity Logs Table (REQUIRED for Log Service)
create table if not exists avt_activity_logs (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamptz default now(),
  username text,
  role text,
  action_type text, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
  entity_type text, -- 'SALE', 'PURCHASE', 'PAYMENT', etc.
  entity_id text,
  details text
);

-- 2. Users Table
create table if not exists avt_users (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  password text not null,
  role text default 'ADMIN' -- 'ADMIN', 'SUPER_ADMIN'
);

-- 3. Purchases Table
create table if not exists avt_purchases (
  id uuid default gen_random_uuid() primary key,
  date date,
  supplier text,
  coop text,
  driver text,
  plate text,
  heads numeric default 0,
  kg numeric default 0,
  avg_weight numeric default 0,
  buy_price numeric default 0,
  total_buy_cost numeric default 0,
  is_distributed boolean default false
);

-- 4. Sales Table
create table if not exists avt_sales (
  id uuid default gen_random_uuid() primary key,
  purchase_id uuid, -- Link to avt_purchases.id
  customer_id text,
  customer_name text,
  customer_address text,
  date date,
  sold_heads numeric default 0,
  sold_kg numeric default 0,
  sell_price numeric default 0,
  mortality_heads numeric default 0,
  mortality_kg numeric default 0,
  unloading_cost numeric default 0,
  driver_bonus numeric default 0,
  operational_cost numeric default 0,
  truck_cost numeric default 0,
  payments jsonb default '[]'::jsonb -- Array of payment objects
);

-- 5. Customer Payments Table (Global/Bulk Payments)
create table if not exists avt_customer_payments (
  id uuid default gen_random_uuid() primary key,
  date date,
  customer_id text,
  customer_name text,
  transfer_amount numeric default 0,
  cash_amount numeric default 0,
  unloading_cost numeric default 0,
  driver_bonus numeric default 0,
  other_cost numeric default 0,
  notes text,
  total_paid numeric default 0
);

-- 6. Supplier Payments Table
create table if not exists avt_supplier_payments (
    id uuid default gen_random_uuid() primary key,
    date date,
    supplier_name text,
    amount numeric default 0,
    method text,
    notes text
);

-- 7. Driver Transactions Table
create table if not exists avt_driver_transactions (
    id uuid default gen_random_uuid() primary key,
    driver_name text,
    date date,
    amount numeric default 0,
    type text, -- 'PAYMENT' or 'MANUAL_BON'
    notes text
);

-- 8. Master Data Tables
create table if not exists avt_customers (
    id uuid default gen_random_uuid() primary key,
    name text unique,
    address text,
    phone text
);

create table if not exists avt_suppliers (
    id uuid default gen_random_uuid() primary key,
    name text unique
);

create table if not exists avt_coops (
    id uuid default gen_random_uuid() primary key,
    name text unique,
    location text
);

create table if not exists avt_drivers_list (
    id uuid default gen_random_uuid() primary key,
    value text unique
);

create table if not exists avt_plates_list (
    id uuid default gen_random_uuid() primary key,
    value text unique
);

-- 9. PERFORMANCE INDEXES (Run this to make app faster)
create index if not exists idx_purchases_date on avt_purchases(date);
create index if not exists idx_purchases_supplier on avt_purchases(supplier);
create index if not exists idx_purchases_plate on avt_purchases(plate);

create index if not exists idx_sales_date on avt_sales(date);
create index if not exists idx_sales_customer_id on avt_sales(customer_id);
create index if not exists idx_sales_purchase_id on avt_sales(purchase_id);

create index if not exists idx_cust_payments_date on avt_customer_payments(date);
create index if not exists idx_cust_payments_customer_id on avt_customer_payments(customer_id);

create index if not exists idx_logs_timestamp on avt_activity_logs(timestamp);
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-green-400" />
                <h2 className="text-lg font-bold">Setup Database / Fix Schema Error</h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        <div className="bg-blue-50 p-4 border-b border-blue-100 text-sm text-blue-800">
            <p><strong>Cara Memperbaiki Error Schema / Optimasi Database:</strong></p>
            <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>Copy kode SQL di bawah ini.</li>
                <li>Buka Dashboard Supabase Anda.</li>
                <li>Masuk ke menu <strong>SQL Editor</strong>.</li>
                <li>Paste kode tersebut dan klik <strong>RUN</strong>.</li>
            </ol>
            <p className="mt-2 text-xs italic">
                *Script ini aman dijalankan berulang kali (menggunakan <code>if not exists</code>).
            </p>
        </div>

        {/* SQL Content */}
        <div className="flex-1 overflow-auto bg-slate-900 text-slate-300 p-4 font-mono text-xs md:text-sm">
            <pre>{sqlContent}</pre>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
            <button 
                onClick={handleCopy}
                className={`flex items-center gap-2 px-6 py-2 rounded font-bold transition-all ${copied ? 'bg-green-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
            >
                {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy SQL</>}
            </button>
            <button 
                onClick={onClose}
                className="px-6 py-2 border border-slate-300 rounded hover:bg-slate-200 font-medium"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default SchemaModal;