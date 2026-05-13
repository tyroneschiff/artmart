-- Threaded replies, one level deep. A comment can have a
-- parent_comment_id pointing to another comment (top-level comments
-- have parent_comment_id = NULL). The app filters top-level for the
-- main list and renders matching children indented beneath each.
--
-- One level only (no replies-to-replies) to keep the UI tractable
-- and avoid Reddit-style nesting on a tiny mobile thread. We don't
-- enforce that depth in SQL — the app simply doesn't surface a
-- "Reply" button on already-nested replies.
--
-- ON DELETE CASCADE so deleting a parent removes its children. RLS
-- in 004_comments.sql already gates inserts to auth.uid() = user_id,
-- so existing policies cover replies without modification.

alter table public.comments
  add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;

create index if not exists comments_parent_idx
  on public.comments (parent_comment_id) where parent_comment_id is not null;
