-- Kibo AI Phase 2: brand/template attribution, spending limits, template seeds.

-- ── Link generations to the brand/template that shaped them ────────────────
alter table generations
  add column if not exists brand_id uuid references brand_profiles (id) on delete set null;
alter table generations
  add column if not exists template_id uuid references prompt_templates (id) on delete set null;

-- ── Monthly spending limits ────────────────────────────────────────────────
create table if not exists spending_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  monthly_limit_usd numeric(10, 2) not null check (monthly_limit_usd > 0),
  updated_at timestamptz not null default now()
);

alter table spending_limits enable row level security;

create policy "own_limits" on spending_limits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Public prompt template seeds ───────────────────────────────────────────
insert into prompt_templates
  (user_id, name, description, prompt_structure, aspect_ratio, recommended_models, duration_seconds, is_public)
values
  (null, 'Instagram Product Poster',
   'Square product hero with punchy copy space.',
   'Premium product photography of {subject}, centered on a clean backdrop with soft studio light, generous copy space above, ultra sharp, commercial quality',
   '1:1', '["soul-2", "ideogram", "qwen-image"]', null, true),
  (null, 'TikTok Advertisement',
   'Vertical 5s hook with native audio.',
   'Fast-paced vertical ad opener for {subject}: bold hook in the first second, dynamic camera push, vibrant light, built for sound-on viewing',
   '9:16', '["seedance-2.5", "kling-3-turbo", "pixverse"]', 5, true),
  (null, 'Cinematic Product Commercial',
   'Widescreen 10s hero spot with slow camera move.',
   'Cinematic commercial for {subject}: slow dolly move, volumetric rim light, shallow depth of field, premium film grade, no text overlays',
   '16:9', '["kling-3-pro", "seedance-2.5"]', 10, true),
  (null, 'Product Photography',
   'Studio macro detail on neutral backdrop.',
   'Macro studio photograph of {subject} on a neutral seamless backdrop, single large softbox, crisp micro detail, true colors, e-commerce hero shot',
   '4:3', '["soul-2", "qwen-image", "recraft"]', null, true),
  (null, 'Corporate Advertisement',
   'Clean, trustworthy brand spot.',
   'Polished corporate advertisement featuring {subject}: bright optimistic light, modern office or lifestyle context, diverse people, trustworthy premium mood',
   '16:9', '["soul-cinema", "soul-2", "kling-3-std"]', 5, true),
  (null, 'Talking Product Demo',
   'Presenter-style clip with generated dialogue audio.',
   'Friendly presenter demonstrating {subject} to camera, natural gestures, bright retail environment, clear speech audio, upbeat trustworthy tone',
   '9:16', '["seedance-2.5", "minimax-hailuo"]', 10, true),
  (null, 'Image-to-Video Animation',
   'Bring a finished still to life with gentle motion.',
   'Gentle cinematic motion over this frame: slow parallax drift, subtle light shimmer, living background detail, keep the subject faithful to the source image',
   '16:9', '["kling-3-std", "wan-3", "ltx-2.5-pro"]', 5, true),
  (null, 'Social Media Reel',
   'Punchy vertical loop for feeds.',
   'High-energy vertical reel for {subject}: quick cuts feel, saturated color, rhythmic motion matched to beat, seamless loop ending',
   '9:16', '["seedance-2.0-fast", "grok-imagine-video", "pixverse"]', 5, true),
  (null, 'YouTube Advertisement',
   'Skippable-proof 10s widescreen story.',
   'Ten-second widescreen ad story for {subject}: brand reveal in the first two seconds, clear benefit demonstration, end card composition with copy space',
   '16:9', '["kling-3-std", "seedance-2.5"]', 10, true)
on conflict do nothing;
