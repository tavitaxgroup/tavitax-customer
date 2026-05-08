import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { initResumableUpload } from "@/lib/google-drive"

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

    // Xin Google cấp phát Resumable Upload URL
    const result = await initResumableUpload(fileName, mimeType)

    if (!result.success) {
      return NextResponse.json({ error: "Cannot initialize upload session" }, { status: 500 })
    }

    return NextResponse.json({ uploadUrl: result.uploadUrl })

  } catch (error: any) {
    console.error("Upload Init Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
