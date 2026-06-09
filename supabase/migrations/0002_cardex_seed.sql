-- =============================================================================
-- CarDex — v1 seed data
-- Run AFTER 0001_cardex_schema.sql (via the service role, which bypasses RLS).
--
-- A curated starter catalogue (~46 cars) spread across all five rarity tiers,
-- a placeholder sprite per car, and six themed completable sets.
-- All inserts are idempotent (ON CONFLICT DO NOTHING), so re-running is safe.
-- Every car carries a non-null generation so the (make, model, generation)
-- unique key actually dedupes on re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Cars catalogue
-- ---------------------------------------------------------------------------
insert into cars (make, model, generation, body, rarity_tier) values
  -- Commons (everyday metal)
  ('Toyota',        'Corolla',           'E120',    'sedan',       'common'),
  ('Honda',         'Civic',             'EK',      'hatchback',   'common'),
  ('Ford',          'Focus',             'Mk2',     'hatchback',   'common'),
  ('Volkswagen',    'Golf',              'Mk5',     'hatchback',   'common'),
  ('Vauxhall',      'Corsa',             'C',       'hatchback',   'common'),
  ('Ford',          'Fiesta',            'Mk6',     'hatchback',   'common'),
  ('Toyota',        'Yaris',             'XP90',    'hatchback',   'common'),
  ('Nissan',        'Qashqai',           'J10',     'suv',         'common'),
  ('Honda',         'Jazz',              'GE',      'hatchback',   'common'),
  ('Hyundai',       'i30',               'FD',      'hatchback',   'common'),

  -- Uncommons (warm hatches & entry exec/roadsters)
  ('Volkswagen',    'Golf GTI',          'Mk5',     'hatchback',   'uncommon'),
  ('Ford',          'Focus ST',          'Mk2',     'hatchback',   'uncommon'),
  ('BMW',           '3 Series',          'E46',     'sedan',       'uncommon'),
  ('Audi',          'A4',                'B7',      'sedan',       'uncommon'),
  ('Mercedes-Benz', 'C-Class',           'W204',    'sedan',       'uncommon'),
  ('Mazda',         'MX-5',              'NB',      'convertible', 'uncommon'),
  ('Mini',          'Cooper',            'R53',     'hatchback',   'uncommon'),
  ('Subaru',        'Impreza WRX',       'GD',      'sedan',       'uncommon'),
  ('Volkswagen',    'Golf GTI',          'Mk2',     'hatchback',   'uncommon'),
  ('Peugeot',       '205 GTI',           'A',       'hatchback',   'uncommon'),

  -- Rares (icons & fast saloons)
  ('Nissan',        'Skyline GT-R',      'R34',     'coupe',       'rare'),
  ('Toyota',        'Supra',             'A80',     'coupe',       'rare'),
  ('Honda',         'NSX',               'NA1',     'sports',      'rare'),
  ('Mazda',         'RX-7',              'FD',      'coupe',       'rare'),
  ('Mitsubishi',    'Lancer Evolution',  'VI',      'sedan',       'rare'),
  ('BMW',           'M3',                'E46',     'coupe',       'rare'),
  ('Audi',          'RS4',               'B7',      'wagon',       'rare'),
  ('Porsche',       '911 Carrera',       '996',     'coupe',       'rare'),
  ('Lotus',         'Elise',             'S2',      'sports',      'rare'),
  ('Subaru',        'Impreza 22B',       'GC',      'coupe',       'rare'),

  -- Epics (modern supercars & super-saloons)
  ('Ferrari',       '360 Modena',        'F131',    'sports',      'epic'),
  ('Lamborghini',   'Gallardo',          'Mk1',     'sports',      'epic'),
  ('Porsche',       '911 GT3',           '997',     'coupe',       'epic'),
  ('Nissan',        'GT-R',              'R35',     'coupe',       'epic'),
  ('Audi',          'R8',                'Type42',  'sports',      'epic'),
  ('Aston Martin',  'Vantage',           'VH',      'coupe',       'epic'),
  ('BMW',           'M5',                'E60',     'sedan',       'epic'),
  ('Mercedes-AMG',  'GT',                'C190',    'coupe',       'epic'),

  -- Legendaries (hall of fame)
  ('Ferrari',       'F40',               'F120',    'sports',      'legendary'),
  ('Lamborghini',   'Countach',          'LP400',   'sports',      'legendary'),
  ('McLaren',       'F1',                'Mk1',     'sports',      'legendary'),
  ('Bugatti',       'Veyron',            '16.4',    'sports',      'legendary'),
  ('Porsche',       'Carrera GT',        '980',     'sports',      'legendary'),
  ('Ferrari',       'Enzo',              'F140',    'sports',      'legendary'),
  ('Jaguar',        'E-Type',            'Series1', 'coupe',       'legendary'),
  ('Ford',          'GT40',              'Mk1',     'sports',      'legendary')
on conflict (make, model, generation) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Placeholder sprites — one current sprite per car (art is non-blocking)
-- ---------------------------------------------------------------------------
insert into sprites (car_id, asset_url, is_current)
select c.id, '/sprites/placeholder/' || c.id || '.png', true
from cars c
where not exists (
  select 1 from sprites s where s.car_id = c.id and s.is_current
);

-- ---------------------------------------------------------------------------
-- 3. Themed sets
-- ---------------------------------------------------------------------------
insert into sets (slug, name, theme, description) values
  ('everyday-commons',  'Everyday Commons',   'common',     'The cars you walk past every day. Easy starters to get the collection rolling.'),
  ('hot-hatch',         'Hot Hatch Heroes',   'hot-hatch',  'Pocket rockets and warm hatches that defined the breed.'),
  ('jdm-90s',           '90s JDM Legends',    'jdm',        'The golden-era Japanese icons everyone wants in their garage.'),
  ('german-exec',       'German Executives',  'german',     'Premium saloons and the M / RS cars hiding among them.'),
  ('track-day',         'Track Day Toys',     'track',      'Lightweight and focused machines built for corners.'),
  ('supercar-royalty',  'Supercar Royalty',   'supercar',   'The legends. Spotting one of these is a story you tell people.')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Set membership
--   Each block joins the catalogue against a (make, model, generation) list,
--   so it is robust to the generated car ids. Cars may belong to many sets.
-- ---------------------------------------------------------------------------

-- Everyday Commons
insert into set_cars (set_id, car_id)
select (select id from sets where slug = 'everyday-commons'), c.id
from cars c
join (values
  ('Toyota','Corolla','E120'),
  ('Honda','Civic','EK'),
  ('Ford','Focus','Mk2'),
  ('Volkswagen','Golf','Mk5'),
  ('Vauxhall','Corsa','C'),
  ('Ford','Fiesta','Mk6'),
  ('Toyota','Yaris','XP90'),
  ('Nissan','Qashqai','J10')
) as m(make, model, generation)
  on m.make = c.make and m.model = c.model and m.generation = c.generation
on conflict do nothing;

-- Hot Hatch Heroes
insert into set_cars (set_id, car_id)
select (select id from sets where slug = 'hot-hatch'), c.id
from cars c
join (values
  ('Volkswagen','Golf GTI','Mk5'),
  ('Ford','Focus ST','Mk2'),
  ('Mini','Cooper','R53'),
  ('Volkswagen','Golf GTI','Mk2'),
  ('Peugeot','205 GTI','A')
) as m(make, model, generation)
  on m.make = c.make and m.model = c.model and m.generation = c.generation
on conflict do nothing;

-- 90s JDM Legends
insert into set_cars (set_id, car_id)
select (select id from sets where slug = 'jdm-90s'), c.id
from cars c
join (values
  ('Nissan','Skyline GT-R','R34'),
  ('Toyota','Supra','A80'),
  ('Honda','NSX','NA1'),
  ('Mazda','RX-7','FD'),
  ('Mitsubishi','Lancer Evolution','VI'),
  ('Subaru','Impreza 22B','GC'),
  ('Subaru','Impreza WRX','GD'),
  ('Mazda','MX-5','NB')
) as m(make, model, generation)
  on m.make = c.make and m.model = c.model and m.generation = c.generation
on conflict do nothing;

-- German Executives
insert into set_cars (set_id, car_id)
select (select id from sets where slug = 'german-exec'), c.id
from cars c
join (values
  ('BMW','3 Series','E46'),
  ('Audi','A4','B7'),
  ('Mercedes-Benz','C-Class','W204'),
  ('BMW','M3','E46'),
  ('Audi','RS4','B7'),
  ('BMW','M5','E60')
) as m(make, model, generation)
  on m.make = c.make and m.model = c.model and m.generation = c.generation
on conflict do nothing;

-- Track Day Toys
insert into set_cars (set_id, car_id)
select (select id from sets where slug = 'track-day'), c.id
from cars c
join (values
  ('Honda','NSX','NA1'),
  ('Lotus','Elise','S2'),
  ('Porsche','911 GT3','997'),
  ('Ferrari','360 Modena','F131'),
  ('Aston Martin','Vantage','VH')
) as m(make, model, generation)
  on m.make = c.make and m.model = c.model and m.generation = c.generation
on conflict do nothing;

-- Supercar Royalty
insert into set_cars (set_id, car_id)
select (select id from sets where slug = 'supercar-royalty'), c.id
from cars c
join (values
  ('Ferrari','F40','F120'),
  ('Lamborghini','Countach','LP400'),
  ('McLaren','F1','Mk1'),
  ('Bugatti','Veyron','16.4'),
  ('Porsche','Carrera GT','980'),
  ('Ferrari','Enzo','F140'),
  ('Ford','GT40','Mk1')
) as m(make, model, generation)
  on m.make = c.make and m.model = c.model and m.generation = c.generation
on conflict do nothing;
