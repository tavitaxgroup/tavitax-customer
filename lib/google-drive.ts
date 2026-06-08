import { google } from "googleapis"
import { Readable } from "stream"

function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  })

  return google.drive({ version: "v3", auth: oauth2Client })
}

export async function uploadToDrive(fileBuffer: Buffer, fileName: string, mimeType: string) {
  try {
    const drive = getDriveClient()
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

    const stream = new Readable()
    stream.push(fileBuffer)
    stream.push(null)

    const fileMetadata = {
      name: fileName,
      parents: folderId ? [folderId] : [],
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: { mimeType, body: stream },
      fields: "id, webViewLink",
    })

    return { success: true, fileId: response.data.id, webViewLink: response.data.webViewLink }
  } catch (error: any) {
    console.error("Google Drive API Error:", error)
    return { success: false, error: error.message }
  }
}

export async function getOrCreateCustomerFolder(folderName: string) {
  try {
    const drive = getDriveClient()
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID

    // 1. Tìm xem thư mục khách hàng đã tồn tại chưa
    const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false and '${rootFolderId}' in parents`
    const res = await drive.files.list({
      q: query,
      fields: "files(id, name)",
      spaces: "drive"
    })

    if (res.data.files && res.data.files.length > 0) {
      // Đã có thư mục, trả về ID của thư mục đó
      return { success: true, folderId: res.data.files[0].id }
    }

    // 2. Chưa có thì tạo thư mục mới
    const fileMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: rootFolderId ? [rootFolderId] : []
    }

    const createRes = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id"
    })

    return { success: true, folderId: createRes.data.id }
  } catch (error: any) {
    console.error("Get/Create Folder Error:", error)
    return { success: false, error: error.message }
  }
}

export async function getOrCreateFolderInParent(folderName: string, parentId: string) {
  try {
    const drive = getDriveClient()

    const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false and '${parentId}' in parents`
    const res = await drive.files.list({
      q: query,
      fields: "files(id, name)",
      spaces: "drive"
    })

    if (res.data.files && res.data.files.length > 0) {
      return { success: true, folderId: res.data.files[0].id }
    }

    const fileMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId]
    }

    const createRes = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id"
    })

    return { success: true, folderId: createRes.data.id }
  } catch (error: any) {
    console.error("Get/Create Subfolder Error:", error)
    return { success: false, error: error.message }
  }
}

export async function initResumableUpload(fileName: string, mimeType: string, targetFolderId: string, origin?: string, size?: number) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )

    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
    
    // Get a fresh access token
    const { token } = await oauth2Client.getAccessToken()
    if (!token) throw new Error("Could not get access token")
    
    const headers: any = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": mimeType
    }
    if (origin) {
      headers["Origin"] = origin
    }
    if (typeof size === "number") {
      headers["X-Upload-Content-Length"] = size.toString()
    }

    // Create the upload session
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: fileName,
        parents: targetFolderId ? [targetFolderId] : []
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to init upload session: ${await response.text()}`)
    }

    // Google returns the upload URL in the "Location" header
    const uploadUrl = response.headers.get("Location")
    if (!uploadUrl) throw new Error("No Location header returned from Google")

    return { success: true, uploadUrl }
  } catch (error: any) {
    console.error("Init Resumable Upload Error:", error)
    return { success: false, error: error.message }
  }
}

export async function getFileMetadata(fileId: string): Promise<{success: boolean; webViewLink?: string | null; error?: string}> {
  try {
    const drive = getDriveClient()
    const response = await drive.files.get({
      fileId: fileId,
      fields: "id, webViewLink"
    })
    
    return { success: true, webViewLink: response.data.webViewLink }
  } catch (error: any) {
    console.error("Get File Metadata Error:", error)
    return { success: false, error: error.message }
  }
}
