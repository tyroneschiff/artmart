-- Add explicit foreign key relationship between comments and profiles
-- This allows PostgREST to resolve joins like .select('*, profiles(display_name)')

ALTER TABLE public.comments
ADD CONSTRAINT comments_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;
