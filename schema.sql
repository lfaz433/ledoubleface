-- ==========================================
-- SUPABASE SCHEMA FOR TABLE-TO-KITCHEN LINK
-- ==========================================

-- 1. Create Menu Items Table
create table if exists public.menu_items (
    id text primary key, -- Can use text ids (e.g. 'B1', 'D1') or UUIDs
    name text not null,
    price numeric(10, 2) not null,
    category text not null,
    "desc" text,
    image text,
    popular boolean default false,
    active boolean default true,
    custom_fields jsonb default '[]'::jsonb, -- Array of modifier schemas e.g., [{id, name, type, options, required}]
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Orders Table (Ticket Headers)
create table if exists public.orders (
    id text primary key, -- Format: ORD-XXXXXX
    table_id text not null,
    area text, -- e.g., 'Inside', 'Terrace Patio'
    status text not null default 'pending', -- 'pending' | 'preparing' | 'ready' | 'delivered'
    total numeric(10, 2) not null,
    note text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Order Line Items Table
create table if exists public.order_items (
    id uuid default gen_random_uuid() primary key,
    order_id text references public.orders(id) on delete cascade not null,
    product_id text not null,
    name text not null,
    price numeric(10, 2) not null,
    quantity integer not null,
    customizations jsonb default '{}'::jsonb, -- Selected options e.g., {cooking: "À point", extra: ["Bacon"]}
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create Indexes for performance
create index if exists menu_items_category_idx on public.menu_items(category);
create index if exists orders_status_idx on public.orders(status);
create index if exists order_items_order_id_idx on public.order_items(order_id);

-- 5. Seed Initial Menu Items
insert into public.menu_items (id, name, price, category, "desc", image, popular, active, custom_fields) values
('B1', 'Le Double Face Classic', 14.90, 'Burgers', 'Double wagyu patty, truffle mayo, aged cheddar, lettuce, tomato, brioche bun', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop&auto=format', true, true, '[
  {"id": "c1", "name": "Cooking", "type": "radio", "options": ["Saignant", "À point", "Bien cuit"], "required": true},
  {"id": "c2", "name": "Extras", "type": "checkbox", "options": ["Extra cheese (+€1)", "Extra patty (+€3)", "Bacon (+€2)"], "required": false},
  {"id": "c3", "name": "Sauce", "type": "radio", "options": ["Truffle Mayo", "BBQ", "Sriracha", "None"], "required": false}
]'::jsonb),
('B2', 'Smash & Burn', 13.90, 'Burgers', 'Smash patty, caramelized onion, smoky BBQ, crispy bacon, pickles', 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=300&fit=crop&auto=format', true, true, '[
  {"id": "c1", "name": "Cooking", "type": "radio", "options": ["Saignant", "À point", "Bien cuit"], "required": true},
  {"id": "c3", "name": "Sauce", "type": "radio", "options": ["BBQ", "Mustard", "Mayo", "None"], "required": false}
]'::jsonb),
('C1', 'Crispy Royal Chicken', 12.50, 'Chicken', 'Crispy buttermilk chicken, pickled jalapeños, garlic aioli, coleslaw', 'https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop&auto=format', false, true, '[
  {"id": "c4", "name": "Heat Level", "type": "radio", "options": ["Mild", "Medium", "Hot", "Extra Hot"], "required": true}
]'::jsonb),
('S1', 'La Truffe Fries', 6.90, 'Sides', 'Belgian fries, black truffle oil, parmesan, fresh herbs', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop&auto=format', true, true, '[
  {"id": "c5", "name": "Size", "type": "radio", "options": ["Regular", "Large (+€2)"], "required": true}
]'::jsonb),
('S2', 'Onion Rings', 5.50, 'Sides', 'Beer-battered onion rings, spicy dipping sauce', 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&h=300&fit=crop&auto=format', false, true, '[]'::jsonb),
('D1', 'Double Shake Vanille', 7.50, 'Drinks', 'Thick premium vanilla milkshake, Madagascar vanilla', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop&auto=format', false, true, '[
  {"id": "c6", "name": "Size", "type": "radio", "options": ["Regular", "Large (+€1.5)"], "required": true}
]'::jsonb),
('D2', 'Sparkling Water', 2.50, 'Drinks', 'Premium French sparkling mineral water 33cl', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=300&fit=crop&auto=format', false, true, '[]'::jsonb),
('V1', 'Le Vegan Face', 11.90, 'Vegan', 'Plant-based patty, avocado cream, sun-dried tomatoes, rocket', 'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=400&h=300&fit=crop&auto=format', false, true, '[
  {"id": "c3", "name": "Sauce", "type": "radio", "options": ["Vegan Mayo", "Guacamole", "None"], "required": false}
]'::jsonb)
on conflict (id) do nothing;

-- 6. Enable Row Level Security (RLS)
-- For a public-facing decentralized PWA menu, we allow anonymous read/write access.
-- You can restrict these policies later as your business operations grow.
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Policies for menu_items
create policy "Allow public read-only access to menu items"
on public.menu_items for select using (true);

create policy "Allow public insert access to menu items for CMS"
on public.menu_items for insert with check (true);

create policy "Allow public update access to menu items for CMS"
on public.menu_items for update using (true);

create policy "Allow public delete access to menu items for CMS"
on public.menu_items for delete using (true);

-- Policies for orders
create policy "Allow public read access to orders"
on public.orders for select using (true);

create policy "Allow public insert access to orders"
on public.orders for insert with check (true);

create policy "Allow public update access to orders"
on public.orders for update using (true);

create policy "Allow public delete access to orders"
on public.orders for delete using (true);

-- Policies for order_items
create policy "Allow public read access to order items"
on public.order_items for select using (true);

create policy "Allow public insert access to order items"
on public.order_items for insert with check (true);

create policy "Allow public update access to order items"
on public.order_items for update using (true);

create policy "Allow public delete access to order items"
on public.order_items for delete using (true);

-- 7. Enable Realtime Publications
-- Enable realtime for menu_items and orders so they sync across devices instantly.
begin;
  alter publication supabase_realtime add table public.menu_items;
  alter publication supabase_realtime add table public.orders;
  alter publication supabase_realtime add table public.order_items;
exception when others then
  raise notice 'Could not automatically add to publication';
end;
commit;

-- 8. Advanced Hospitality Additions
-- Add columns to orders
alter table public.orders add column if not exists paid boolean default false;
alter table public.orders add column if not exists invoice_no text;

-- Create Restaurant Tables Registry
create table if not exists public.restaurant_tables (
    id text primary key, -- T01, T02, etc.
    area text not null default 'Inside Lounge', -- 'Terrace Patio' | 'Inside Lounge'
    is_terrace boolean default false,
    waiter_called boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seed initial tables
insert into public.restaurant_tables (id, area, is_terrace, waiter_called) values
('T01', 'Inside Lounge', false, false),
('T02', 'Inside Lounge', false, false),
('T03', 'Inside Lounge', false, false),
('T04', 'Inside Lounge', false, false),
('T05', 'Inside Lounge', false, false),
('T06', 'Inside Lounge', false, false),
('T07', 'Terrace Patio', true, false),
('T08', 'Terrace Patio', true, false),
('T09', 'Terrace Patio', true, false),
('T10', 'Terrace Patio', true, false),
('T11', 'Terrace Patio', true, false),
('T12', 'Terrace Patio', true, false)
on conflict (id) do nothing;

-- Create Shows Table
create table if not exists public.shows (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    description text,
    date timestamp with time zone not null,
    price numeric(10, 2) not null,
    image text,
    available_tickets integer default 50,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seed Initial Show
insert into public.shows (title, description, date, price, image, available_tickets) values
('Gipsy Kings Tribute Night', 'Live acoustic flamenco performance under the Parisian stars. Real fire, real guitars, and authentic tapas experience.', now() + interval '5 days', 25.00, 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&h=400&fit=crop&auto=format', 45),
('Cabaret Parisien Double Face', 'A mesmerizing double-act drag & cabaret dinner show detailing history, music, and comedy.', now() + interval '12 days', 35.00, 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&h=400&fit=crop&auto=format', 30)
on conflict do nothing;

-- Create Tickets Table
create table if not exists public.tickets (
    id uuid default gen_random_uuid() primary key,
    show_id uuid references public.shows(id) on delete cascade not null,
    customer_name text not null,
    customer_email text not null,
    quantity integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for new tables
alter table public.restaurant_tables enable row level security;
alter table public.shows enable row level security;
alter table public.tickets enable row level security;

-- Policies for restaurant_tables
create policy "Allow public read access to tables" on public.restaurant_tables for select using (true);
create policy "Allow public insert access to tables" on public.restaurant_tables for insert with check (true);
create policy "Allow public update access to tables" on public.restaurant_tables for update using (true);
create policy "Allow public delete access to tables" on public.restaurant_tables for delete using (true);

-- Policies for shows
create policy "Allow public read access to shows" on public.shows for select using (true);
create policy "Allow public insert access to shows" on public.shows for insert with check (true);
create policy "Allow public update access to shows" on public.shows for update using (true);
create policy "Allow public delete access to shows" on public.shows for delete using (true);

-- Policies for tickets
create policy "Allow public read access to tickets" on public.tickets for select using (true);
create policy "Allow public insert access to tickets" on public.tickets for insert with check (true);
create policy "Allow public update access to tickets" on public.tickets for update using (true);
create policy "Allow public delete access to tickets" on public.tickets for delete using (true);

-- Enable Realtime for additions
begin;
  alter publication supabase_realtime add table public.restaurant_tables;
  alter publication supabase_realtime add table public.shows;
  alter publication supabase_realtime add table public.tickets;
exception when others then
  raise notice 'Could not add additions to publication';
end;
commit;
