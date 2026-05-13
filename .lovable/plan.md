## Problem

The logo upload to the `avatars` storage bucket fails with `new row violates row-level security policy`.

The bucket's INSERT policy requires the **first folder of the object path to equal the user's id**:

```
(auth.uid())::text = (storage.foldername(name))[1]
```

But `src/pages/sitter/settings/Branding.tsx` uploads to:

```
branding/{user.id}/logo-{timestamp}.{ext}
```

So the first folder is `branding`, not the user id — RLS rejects it.

## Fix

Change the upload path in `Branding.tsx` so the user id comes first:

```
{user.id}/branding/logo-{timestamp}.{ext}
```

That's a one-line change in `onUploadLogo` and matches the existing avatar/pets RLS pattern. No database migration needed.

Existing logos uploaded under the old path (if any succeeded) keep working because they're already public — only new uploads change location.
