# Car Submissions — Admin Review (Supabase Studio)

How to audit community-submitted cars and approve/reject them. Moderation runs
in the Supabase dashboard (SQL editor + Storage browser) — no separate app.

## One-time setup

1. Apply migrations `0007` then `0008`.
2. Create a **private** Storage bucket named `submissions` (Storage → New bucket,
   "Public" OFF). Then apply the upload policy (SQL editor):
   ```sql
   create policy "users upload to own submission folder"
     on storage.objects for insert to authenticated
     with check (
       bucket_id = 'submissions'
       and (storage.foldername(name))[1] = (select auth.uid())::text
     );
   ```
3. Deploy the function:
   ```bash
   supabase functions deploy submit-car
   ```
4. Make yourself an admin (optional — only needed for a future in-app admin UI;
   Studio review works without it):
   ```sql
   update profiles set role = 'admin' where handle = '<your-handle>';
   ```

## The review loop

**1. See what's waiting:**
```sql
select * from admin_pending_submissions;
```

**2. Inspect one submission's photos.** Get the image keys:
```sql
select id, storage_path from submission_images where submission_id = <ID>;
```
Then open each in Storage → `submissions` bucket (or generate a temporary link):
```sql
-- signed URLs valid 1 hour, to eyeball without making the bucket public
select name, (storage.create_signed_url('submissions', name, 3600))
from storage.objects
where bucket_id = 'submissions'
  and name = any (
    select storage_path from submission_images where submission_id = <ID>
  );
```

**3a. Approve** — mints the catalogue car + a `model_class`, links it, awards the
contributor badge. Optionally set rarity (defaults to `common`):
```sql
select approve_submission(<ID>);                 -- common
select approve_submission(<ID>, 'rare');         -- with rarity
```
Returns the new `cars.id`.

**3b. Reject** — with a note (shown to nobody yet, but kept for audit):
```sql
select reject_submission(<ID>, 'duplicate of #1421 / blurry photos');
```

**4. Fix details before approving** (if make/model/body/years need cleanup):
```sql
update car_submissions
   set make = 'Toyota', model = 'GR Yaris', body = 'hatchback',
       year_start = 2020, year_end = 2024
 where id = <ID>;
```

## After approval

- The car exists in the catalogue immediately (catchable via manual search) but
  is **not auto-recognized until the next retrain** — its `model_class` has no
  trained weights yet.
- The submitted images are labeled training data. Fold them in: the export step
  pulls approved-submission images into `train/<model_class>/` alongside the
  retained captures (see the training export script), then retrain + bump
  `MODEL_VERSION`.

## Housekeeping

- Rejected submissions keep their images in the bucket. Periodically hard-delete
  them (Storage browser, or a service-role script) — there's no auto-cleanup.
- `approve_submission` / `reject_submission` are service-role only (not granted
  to app users), so they can only be run here or from a trusted server.
