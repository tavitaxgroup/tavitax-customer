import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { initResumableUpload, getOrCreateCustomerFolder, getOrCreateFolderInParent } from "@/lib/google-drive"

const customerFolderPromiseCache = new Map<string, Promise<string>>()
const subFolderPromiseCache = new Map<string, Promise<string>>()

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
    
    let targetFolderId: string
    
    // Lấy hoặc tạo thư mục khách hàng (có lock promise)
    if (customerFolderPromiseCache.has(folderName)) {
      try {
        targetFolderId = await customerFolderPromiseCache.get(folderName)!
      } catch (e) {
        return NextResponse.json({ error: "Không thể khởi tạo thư mục khách hàng trên Drive" }, { status: 500 })
      }
    } else {
      const promise = getOrCreateCustomerFolder(folderName).then(res => {
        if (!res.success || !res.folderId) throw new Error("Failed to create customer folder")
        return res.folderId
      })
      customerFolderPromiseCache.set(folderName, promise)
      try {
        targetFolderId = await promise
      } catch (e) {
        customerFolderPromiseCache.delete(folderName)
        return NextResponse.json({ error: "Không thể khởi tạo thư mục khách hàng trên Drive" }, { status: 500 })
      }
    }

    let finalFileName = fileName

    const pathParts = fileName.split('/')
    if (pathParts.length > 1) {
      finalFileName = pathParts.pop()!
      for (const part of pathParts) {
        const cacheKey = `${targetFolderId}_${part}`
        
        if (subFolderPromiseCache.has(cacheKey)) {
          try {
            targetFolderId = await subFolderPromiseCache.get(cacheKey)!
          } catch(e) {
            return NextResponse.json({ error: "Lỗi tạo thư mục con trên Drive" }, { status: 500 })
          }
        } else {
          const promise = getOrCreateFolderInParent(part, targetFolderId).then(res => {
            if (!res.success || !res.folderId) throw new Error("Failed to create subfolder")
            return res.folderId
          })
          subFolderPromiseCache.set(cacheKey, promise)
          try {
            targetFolderId = await promise
          } catch (e) {
            subFolderPromiseCache.delete(cacheKey)
            return NextResponse.json({ error: "Lỗi tạo thư mục con trên Drive" }, { status: 500 })
          }
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
