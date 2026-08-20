'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// C1 FIX: Shop admin zones editor
// Re-uses platform zones page but scoped to this branchSlug
export { default } from '@/app/admin/branches/[id]/zones/page'