-- Seeds explicit raw ("roh") and cooked ("gebraten") variants of common meats
-- into public.foods (Tier 1 of services/foodSearch.ts's searchFoodHybrid).
-- Frying drives out ~25-30% of a piece of meat's weight as water, so per-100g
-- values differ by about that much between the two states - a single
-- "Hackfleisch" row can only be right for one of them.
--
-- The app's offline common-foods list (data/foodDatabase.ts) carries the same
-- entries, but the AI photo flow (services/photoMatcher.ts) only ever matches
-- against searchFoodHybrid, i.e. this table - without these rows it has no
-- state-specific entry to verify a detected "Hackfleisch, gebraten" against.
--
-- Same names/values/ids as data/foodDatabase.ts (external_id = that file's
-- seed id), so both sources resolve to the same FoodItem id. Idempotent: the
-- conflict target is the (source, external_id) unique index from 0006, so a
-- re-run only refreshes these rows. Purely additive otherwise - no existing
-- row without one of these external_ids is touched.

insert into public.foods (name, calories_per_100g, carbs_per_100g, protein_per_100g, fat_per_100g, source, external_id)
values
  ('Hähnchenbrust, gebraten', 165, 0, 31, 3.6, 'local', 'local-haehnchenbrust'),
  ('Hähnchenbrust, roh', 108, 0, 23.5, 1.5, 'local', 'local-haehnchenbrust-roh'),
  ('Hähnchenschenkel, gebraten', 216, 0, 26, 12, 'local', 'local-haehnchenschenkel'),
  ('Hähnchenschenkel, roh', 160, 0, 18.5, 9.5, 'local', 'local-haehnchenschenkel-roh'),
  ('Hähnchen mit Haut, gebraten', 250, 0, 27, 15, 'local', 'local-haehnchen-haut'),
  ('Hähnchen mit Haut, roh', 210, 0, 18.5, 15, 'local', 'local-haehnchen-haut-roh'),
  ('Putenbrust, gebraten', 135, 0, 29, 1.7, 'local', 'local-pute'),
  ('Putenbrust, roh', 105, 0, 24, 1, 'local', 'local-pute-roh'),
  ('Rindfleisch mager, gebraten', 187, 0, 26, 9, 'local', 'local-rindfleisch'),
  ('Rindfleisch mager, roh', 140, 0, 20.5, 6.5, 'local', 'local-rindfleisch-roh'),
  ('Schweinefleisch mager, gebraten', 242, 0, 27, 14, 'local', 'local-schweinefleisch'),
  ('Schweinefleisch mager, roh', 172, 0, 20.5, 10, 'local', 'local-schweinefleisch-roh'),
  ('Schweinsfilet, gebraten', 148, 0, 29, 3.5, 'local', 'local-schweinsfilet'),
  ('Schweinsfilet, roh', 110, 0, 22, 2.5, 'local', 'local-schweinsfilet-roh'),
  ('Kalbfleisch mager, gebraten', 172, 0, 24, 8, 'local', 'local-kalbfleisch'),
  ('Kalbfleisch mager, roh', 128, 0, 19.5, 5.5, 'local', 'local-kalbfleisch-roh'),
  ('Lammfleisch, gebraten', 294, 0, 25, 21, 'local', 'local-lammfleisch'),
  ('Lammfleisch, roh', 228, 0, 17.5, 17.5, 'local', 'local-lammfleisch-roh'),
  ('Hackfleisch gemischt, gebraten', 285, 0, 25, 20.5, 'local', 'local-hackfleisch-gebraten'),
  ('Hackfleisch gemischt, roh', 254, 0, 18, 20, 'local', 'local-hackfleisch'),
  ('Rindshackfleisch, gebraten', 257, 0, 26, 17, 'local', 'local-rindshackfleisch-gebraten'),
  ('Rindshackfleisch, roh', 213, 0, 19.5, 15, 'local', 'local-rindshackfleisch-roh'),
  ('Rindshackfleisch light (5% Fett), gebraten', 165, 0, 26.5, 6.5, 'local', 'local-rindshackfleisch-light-gebraten'),
  ('Rindshackfleisch light (5% Fett), roh', 131, 0, 21.5, 5, 'local', 'local-rindshackfleisch-light-roh'),
  ('Speck (Bratspeck), gebraten', 496, 0.5, 34, 40, 'local', 'local-speck-gebraten'),
  ('Speck, roh', 541, 0.5, 12, 55, 'local', 'local-speck')
on conflict (source, external_id) where external_id is not null
do update set
  name = excluded.name,
  calories_per_100g = excluded.calories_per_100g,
  carbs_per_100g = excluded.carbs_per_100g,
  protein_per_100g = excluded.protein_per_100g,
  fat_per_100g = excluded.fat_per_100g,
  updated_at = now();
