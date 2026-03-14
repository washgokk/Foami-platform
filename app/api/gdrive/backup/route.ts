import { NextRequest, NextResponse } from 'next/server'
import { getGoogleDriveClient, createFolderIfNotExist } from '@/lib/google-drive'
import { createServiceClient } from '@/lib/supabase'

/**
 * GDrive Backup API (Lifecycle Day 7)
 * In production, this would be called by a cron job for bookings completed 7 days ago.
 */
export async function POST(req: NextRequest) {
    try {
        const { bookingId } = await req.json()
        if (!bookingId) return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })

        const drive = await getGoogleDriveClient()
        const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID
        const supabaseAdmin = createServiceClient()

        // 1. Get job photos from Supabase
        const { data: photos, error } = await supabaseAdmin
            .from('job_photos')
            .select('*')
            .eq('booking_id', bookingId)

        if (error || !photos || photos.length === 0) {
            return NextResponse.json({ message: 'No photos found for this booking' })
        }

        // 2. Create/Get folder structure: Foami / Booking_[ID]
        const folderId = await createFolderIfNotExist(drive, `Booking_${bookingId}`, parentFolderId)

        // 3. Upload each photo
        const results = []
        for (const photoGroup of photos) {
            const urls = photoGroup.photo_urls || []
            for (const url of urls) {
                try {
                    const response = await fetch(url)
                    const buffer = await response.arrayBuffer()
                    const fileName = url.split('/').pop() || `photo_${Date.now()}.jpg`

                    const fileMetadata = {
                        name: fileName,
                        parents: [folderId]
                    }
                    const media = {
                        mimeType: 'image/jpeg',
                        body: Buffer.from(buffer)
                    }

                    const driveFile = await drive.files.create({
                        resource: fileMetadata,
                        media: media,
                        fields: 'id'
                    } as any)

                    results.push({ url, driveId: driveFile.data.id })
                } catch (uploadErr) {
                    console.error(`Failed to upload ${url}:`, uploadErr)
                }
            }
        }

        // 4. Mark as backed up in metadata if you have a column for it
        // await supabaseAdmin.from('bookings').update({ gdrive_backup_id: folderId }).eq('id', bookingId)

        return NextResponse.json({ 
            success: true, 
            folderId, 
            uploadedCount: results.length 
        })

    } catch (err: any) {
        console.error('GDrive Backup Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
