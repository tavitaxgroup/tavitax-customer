import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getFileMetadata } from "@/lib/google-drive"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { fileName, mimeType, size, fileId } = await req.json()

    if (!fileId) {
      return NextResponse.json({ error: "Missing Google Drive fileId" }, { status: 400 })
    }

    // (Optional) Retrieve WebViewLink from Drive API if needed, 
    // or just construct it (https://drive.google.com/file/d/{fileId}/view)
    const metadata = await getFileMetadata(fileId)
    const driveLink = metadata.success ? metadata.webViewLink : `https://drive.google.com/file/d/${fileId}/view`

    // Lưu vào Database
    const document = await prisma.document.create({
      data: {
        name: fileName,
        size: size,
        mimeType: mimeType,
        googleDriveFileId: fileId,
        driveLink: driveLink,
        status: "UPLOADED",
        userId: session.user.id,
      }
    })

    return NextResponse.json({ success: true, document })

  } catch (error: any) {
    console.error("Upload Confirm Error:", error)
    return NextResponse.json({ error: "Lỗi server nội bộ" }, { status: 500 })
  }
}
