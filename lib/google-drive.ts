import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/drive.file']

export async function getGoogleDriveClient() {
    const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL
    const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (!clientEmail || !privateKey) {
        throw new Error('Google Drive credentials are missing')
    }

    const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: SCOPES
    })

    return google.drive({ version: 'v3', auth })
}

export async function createFolderIfNotExist(drive: any, folderName: string, parentId?: string) {
    const q = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentId ? ` and '${parentId}' in parents` : ''}`
    const res = await drive.files.list({ q, fields: 'files(id, name)' })
    
    if (res.data.files.length > 0) {
        return res.data.files[0].id
    }

    const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined
    }

    const folder = await drive.files.create({
        resource: folderMetadata,
        fields: 'id'
    })

    return folder.data.id
}
