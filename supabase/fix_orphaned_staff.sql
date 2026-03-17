-- ============================================================
-- FIX ORPHANED STAFF RECORDS
-- Run this in Supabase SQL Editor to link Auth users to the Staff table.
-- ============================================================

-- This query inserts a record into public.staff for every user in auth.users
-- that does not already have one. It defaults the role to 'staff' and 
-- assigns them to the FIRST branch in the systems.

INSERT INTO public.staff (id, full_name, email, role, is_active, branch_id)
SELECT 
    au.id, 
    COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'Staff Member'), -- Try to get name from meta or email
    au.email, 
    'staff', 
    true,
    (SELECT id FROM public.branches LIMIT 1) -- Assign to the first branch by default
FROM auth.users au
LEFT JOIN public.staff ps ON au.id = ps.id
WHERE ps.id IS NULL; -- Only those who are missing in public.staff

-- Verify the result
SELECT id, full_name, email, role FROM public.staff;
