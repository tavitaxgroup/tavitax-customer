import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { initResumableUpload, getOrCreateCustomerFolder } from "@/lib/google-drive"

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

    // Sinh tên thư mục riêng cho khách hàng
    const folderName = `${session.user.name || "Khách hàng"} - ${session.user.email}`
    
    // Lấy hoặc tạo thư mục
    const folderResult = await getOrCreateCustomerFolder(folderName)
    if (!folderResult.success || !folderResult.folderId) {
      return NextResponse.json({ error: "Không thể khởi tạo thư mục khách hàng trên Drive" }, { status: 500 })
    }

    // Xin Google cấp phát Resumable Upload URL vào thư mục con
    const result = await initResumableUpload(fileName, mimeType, folderResult.folderId)

    if (!result.success) {
      return NextResponse.json({ error: "Cannot initialize upload session" }, { status: 500 })
    }

    return NextResponse.json({ uploadUrl: result.uploadUrl })

  } catch (error: any) {
    console.error("Upload Init Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
