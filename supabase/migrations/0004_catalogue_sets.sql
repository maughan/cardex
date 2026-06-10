-- =============================================================================
-- CarDex — catalogue-driven sets (v1)
-- Generated against the ingested catalogue (3778 cars). Unlike the 0002 seed
-- sets — which match exact (make, model, generation) tuples and therefore do
-- NOT resolve against the variant-level ingested catalogue (generation is NULL,
-- model strings are uppercase/prefixed) — these sets are PREDICATE-based:
-- membership = a query over make / body / rarity_tier / year_start. That makes
-- them robust to ids, re-runnable, and self-updating after re-ingest.
--
-- Idempotent: upserts sets on slug, clears membership for the managed slugs,
-- then repopulates. Safe to re-run after retraining / re-ingest.
--
-- Cars may belong to many sets (e.g. a Ferrari convertible is in Prancing
-- Horse, Hypercar Club, and Open Air).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Upsert the set definitions.
-- ---------------------------------------------------------------------------
insert into sets (slug, name, theme, description) values
  ('prancing-horse',   'Prancing Horse',     'marque',      'Every Ferrari in the wild. Maranello''s finest — spotting one is always an event.'),
  ('stuttgart-crest',  'Stuttgart Crest',    'marque',      'The complete Porsche run. From 911s to the everyday Stuttgart metal.'),
  ('hypercar-club',    'Hypercar Club',      'performance', 'The exotic elite — Ferrari, Lamborghini, McLaren, Bugatti, Pagani, Koenigsegg, Aston Martin, Maserati.'),
  ('rising-sun',       'Rising Sun',         'region',      'Japan''s finest. JDM legends and everyday Japanese metal alike.'),
  ('stars-and-stripes','Stars & Stripes',    'region',      'American muscle, land yachts, and pickups. Detroit''s full roster.'),
  ('autobahn',         'Autobahn',           'region',      'German engineering — VW, Audi, BMW, Mercedes, Porsche, Opel and more.'),
  ('continental',      'Continental',        'region',      'European exotica and oddballs — Italian, French, British and Scandinavian.'),
  ('open-air',         'Open Air',           'body',        'Drop-tops, roadsters and cabriolets. Roof optional.'),
  ('trail-blazers',    'Trail Blazers',      'body',        'SUVs and 4x4s — the high-riders taking over every road.'),
  ('holy-grails',      'Holy Grails',        'rarity',      'The legendary tier. The cars you tell people about for weeks.'),
  ('apex-predators',   'Apex Predators',     'rarity',      'Epic and legendary machines. The top of the food chain.'),
  ('hidden-gems',      'Hidden Gems',        'rarity',      'Rare-tier finds. Not legendary, but a proper result for any hunt.'),
  ('pre-war-classics', 'Pre-War & Classic',  'era',         'Pre-1960 machinery. The pioneers and the post-war classics.'),
  ('youngtimers',      'Youngtimers',        'era',         'The 1980s and 90s — modern classics in the making.')
on conflict (slug) do update set
  name = excluded.name, theme = excluded.theme, description = excluded.description;

-- ---------------------------------------------------------------------------
-- 2. Clear existing membership for the managed sets, then repopulate.
-- ---------------------------------------------------------------------------
delete from set_cars where set_id in (
  select id from sets where slug in (
    'prancing-horse','stuttgart-crest','hypercar-club','rising-sun',
    'stars-and-stripes','autobahn','continental','open-air','trail-blazers',
    'holy-grails','apex-predators','hidden-gems','pre-war-classics','youngtimers'
  )
);

-- Helper pattern: insert (set, car) for every car matching the set's predicate.

-- Prancing Horse — Ferrari
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.make = 'Ferrari'
where s.slug = 'prancing-horse' on conflict do nothing;

-- Stuttgart Crest — Porsche
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.make = 'Porsche'
where s.slug = 'stuttgart-crest' on conflict do nothing;

-- Hypercar Club — exotic marques
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.make in (
  'Ferrari','Lamborghini','McLaren','Bugatti','Pagani','Koenigsegg',
  'Aston Martin','Maserati'
)
where s.slug = 'hypercar-club' on conflict do nothing;

-- Rising Sun — Japanese marques
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.make in (
  'Toyota','Honda','Nissan','Mazda','Subaru','Mitsubishi','Lexus','Suzuki',
  'Daihatsu','Infiniti','Acura'
)
where s.slug = 'rising-sun' on conflict do nothing;

-- Stars & Stripes — American marques
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.make in (
  'Ford','Chevrolet','Dodge','Cadillac','Chrysler','Lincoln','Jeep','GMC',
  'Buick','Pontiac','Oldsmobile'
)
where s.slug = 'stars-and-stripes' on conflict do nothing;

-- Autobahn — German marques
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.make in (
  'Volkswagen','Audi','BMW','Mercedes-Benz','Opel','Porsche','Maybach','Smart'
)
where s.slug = 'autobahn' on conflict do nothing;

-- Continental — other European marques
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.make in (
  'Fiat','Alfa Romeo','Lancia','Renault','Peugeot','Citroen','Seat','Skoda',
  'Volvo','Saab','MG','Jaguar','Land Rover','Mini','Rover','Vauxhall','Lotus',
  'Bentley','Rolls-Royce'
)
where s.slug = 'continental' on conflict do nothing;

-- Open Air — convertibles
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.body = 'convertible'
where s.slug = 'open-air' on conflict do nothing;

-- Trail Blazers — SUVs
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.body = 'suv'
where s.slug = 'trail-blazers' on conflict do nothing;

-- Holy Grails — legendary
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.rarity_tier = 'legendary'
where s.slug = 'holy-grails' on conflict do nothing;

-- Apex Predators — epic + legendary
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.rarity_tier in ('epic','legendary')
where s.slug = 'apex-predators' on conflict do nothing;

-- Hidden Gems — rare
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.rarity_tier = 'rare'
where s.slug = 'hidden-gems' on conflict do nothing;

-- Pre-War & Classic — year_start < 1960
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.year_start < 1960
where s.slug = 'pre-war-classics' on conflict do nothing;

-- Youngtimers — 1980..1999
insert into set_cars (set_id, car_id)
select s.id, c.id from sets s join cars c on c.year_start between 1980 and 1999
where s.slug = 'youngtimers' on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Sanity check (run manually after applying).
-- ---------------------------------------------------------------------------
-- select s.slug, count(*) as cars
-- from sets s join set_cars sc on sc.set_id = s.id
-- group by s.slug order by cars desc;
