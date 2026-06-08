import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { initResumableUpload, getOrCreateCustomerFolder, getOrCreateFolderInParent } from "@/lib/google-drive"

const folderIdCache = new Map<string, string>()

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { fileName, mimeType, size } = await req.json()

    if (!fileName || !mimeType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const origin = req.headers.get("origin") || undefined

    // Sinh tên thư mục riêng cho khách hàng
    const folderName = `${session.user.name || "Khách hàng"} - ${session.user.email}`
    
    // Lấy hoặc tạo thư mục
    const folderResult = await getOrCreateCustomerFolder(folderName)
    if (!folderResult.success || !folderResult.folderId) {
      return NextResponse.json({ error: "Không thể khởi tạo thư mục khách hàng trên Drive" }, { status: 500 })
    }

    let targetFolderId = folderResult.folderId
    let finalFileName = fileName

    const pathParts = fileName.split('/')
    if (pathParts.length > 1) {
      finalFileName = pathParts.pop()!
      let currentPath = ""
      for (const part of pathParts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part
        const cacheKey = `${targetFolderId}_${part}`
        
        if (folderIdCache.has(cacheKey)) {
          targetFolderId = folderIdCache.get(cacheKey)!
        } else {
          const subResult = await getOrCreateFolderInParent(part, targetFolderId)
          if (!subResult.success || !subResult.folderId) {
            return NextResponse.json({ error: "Lỗi tạo thư mục con trên Drive" }, { status: 500 })
          }
          targetFolderId = subResult.folderId
          folderIdCache.set(cacheKey, targetFolderId)
        }
      }
    }

    // Xin Google cấp phát Resumable Upload URL vào thư mục con
    const result = await initResumableUpload(finalFileName, mimeType, targetFolderId, origin, size)

    if (!result.success) {
      return NextResponse.json({ error: "Cannot initialize upload session" }, { status: 500 })
    }

    return NextResponse.json({ uploadUrl: result.uploadUrl })

  } catch (error: any) {
    console.error("Upload Init Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
