"use client"

import { useState, useRef } from "react"
import { UploadCloud, File, X, CheckCircle2, Loader2, AlertCircle, Folder } from "lucide-react"

export function UploadZone() {
  const [files, setFiles] = useState<File[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [progress, setProgress] = useState(0)
  
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files))
      setStatus("idle")
      setProgress(0)
      setCurrentFileIndex(0)
    }
  }

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort()
    }
    setStatus("idle")
    setProgress(0)
    setFiles([])
    setCurrentFileIndex(0)
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setStatus("uploading")
    setProgress(0)

    try {
      for (let i = 0; i < files.length; i++) {
        setCurrentFileIndex(i)
        setProgress(0)
        const currentFile = files[i]

        const fileName = currentFile.webkitRelativePath || currentFile.name

        // 1. Xin URL upload từ backend
        const initRes = await fetch("/api/upload/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: fileName,
            mimeType: currentFile.type || "application/octet-stream",
            size: currentFile.size
          })
        })

        if (!initRes.ok) throw new Error("Không thể khởi tạo phiên tải lên")
        const { uploadUrl } = await initRes.json()

        // 2. Tải file thẳng lên Google Drive thông qua Resumable URL
        const fileId = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhrRef.current = xhr

          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 100)
              setProgress(percentComplete)
            }
          })

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              // Google trả về thông tin file trong response JSON
              const response = JSON.parse(xhr.responseText)
              resolve(response.id)
            } else {
              reject(new Error("Lỗi khi tải file lên Google Drive"))
            }
          })

          xhr.addEventListener("error", () => reject(new Error("Lỗi kết nối mạng")))
          xhr.addEventListener("abort", () => reject(new Error("Đã hủy tải lên")))

          xhr.open("PUT", uploadUrl, true)
          xhr.setRequestHeader("Content-Type", currentFile.type || "application/octet-stream")
          xhr.send(currentFile)
        })

        // 3. Xác nhận tải lên thành công với backend để lưu DB
        const confirmRes = await fetch("/api/upload/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: fileName,
            mimeType: currentFile.type || "application/octet-stream",
            size: currentFile.size,
            fileId: fileId
          })
        })

        if (!confirmRes.ok) throw new Error("Lỗi khi lưu thông tin tài liệu")
      }

      setStatus("success")
      setFiles([])
      setProgress(100)
      
      setTimeout(() => {
        window.location.reload()
      }, 1500)

    } catch (err: any) {
      if (err.message !== "Đã hủy tải lên") {
        setStatus("error")
        setErrorMsg(err.message || "Đã có lỗi xảy ra")
      }
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 mb-8">
      <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Tải lên tài liệu mới</h2>
      
      <div 
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging 
            ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20" 
            : "border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFiles(Array.from(e.dataTransfer.files))
            setStatus("idle")
            setProgress(0)
            setCurrentFileIndex(0)
          }
        }}
      >
        <input 
          type="file" 
          id="file-upload" 
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={status === "uploading"}
        />
        <input 
          type="file" 
          id="folder-upload" 
          multiple
          // @ts-ignore
          webkitdirectory=""
          directory=""
          className="hidden"
          ref={folderInputRef}
          onChange={handleFileChange}
          disabled={status === "uploading"}
        />
        
        {files.length === 0 ? (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 text-brand-500 dark:text-brand-400 rounded-full flex items-center justify-center mb-4">
              <UploadCloud className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">
              Kéo thả file/thư mục vào đây
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Hỗ trợ file siêu lớn (lên tới vài GB)
            </p>
            <div className="flex gap-4 relative z-10">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
              >
                <File className="w-4 h-4" /> Chọn File
              </button>
              <button 
                onClick={() => folderInputRef.current?.click()}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
              >
                <Folder className="w-4 h-4" /> Chọn Thư mục
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center z-10 relative">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4">
              {files.length > 1 ? <Folder className="w-8 h-8" /> : <File className="w-8 h-8" />}
            </div>
            <p className="font-medium text-slate-900 dark:text-white truncate max-w-xs">
              {files.length === 1 ? (files[0].webkitRelativePath || files[0].name) : `Đã chọn ${files.length} file`}
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Tổng dung lượng: {(files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB
            </p>
            
            {status === "uploading" && (
              <div className="w-full max-w-xs mb-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span className="truncate max-w-[200px]">
                    Đang tải ({currentFileIndex + 1}/{files.length}): {files[currentFileIndex].name}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-brand-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button 
                onClick={(e) => { e.stopPropagation(); cancelUpload() }}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Hủy
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleUpload() }}
                disabled={status === "uploading" || status === "success"}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50"
              >
                {status === "uploading" && <Loader2 className="w-4 h-4 animate-spin" />}
                {status === "uploading" ? "Đang xử lý..." : "Tải lên & Đồng bộ"}
              </button>
            </div>
          </div>
        )}
      </div>

      {status === "success" && (
        <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 flex items-center gap-2 border border-green-200 dark:border-green-800">
          <CheckCircle2 className="w-5 h-5" />
          <span>Tải lên và đồng bộ thành công! Đang làm mới danh sách...</span>
        </div>
      )}
      
      {status === "error" && (
        <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 flex items-center gap-2 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-5 h-5" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  )
}
