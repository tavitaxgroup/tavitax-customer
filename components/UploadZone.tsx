"use client"

import { useState, useRef } from "react"
import { UploadCloud, File as FileIcon, X, CheckCircle2, Loader2, AlertCircle, Folder } from "lucide-react"
import JSZip from "jszip"

export function UploadZone() {
  const [files, setFiles] = useState<File[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<"idle" | "zipping" | "uploading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [progress, setProgress] = useState(0)
  
  const activeXhrsRef = useRef<Set<XMLHttpRequest>>(new Set())
  const loadedBytesRef = useRef<number[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files))
      setStatus("idle")
      setProgress(0)
      setCompletedCount(0)
    }
  }

  const cancelUpload = () => {
    activeXhrsRef.current.forEach(xhr => xhr.abort())
    activeXhrsRef.current.clear()
    setStatus("idle")
    setProgress(0)
    setFiles([])
    setCompletedCount(0)
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setStatus("zipping")
    setProgress(0)
    setCompletedCount(0)
    setErrorMsg("")

    try {
      const isFolderUpload = files.length > 0 && files[0].webkitRelativePath !== ""
      const folderName = isFolderUpload ? files[0].webkitRelativePath.split('/')[0] : ""
      
      let filesToProcess = files;

      if (isFolderUpload) {
        setStatus("zipping")
        const zip = new JSZip();
        files.forEach(f => {
          zip.file(f.webkitRelativePath, f);
        });

        const zipBlob = await zip.generateAsync({ 
          type: "blob",
          compression: "STORE" // Nén không giảm dung lượng để đóng gói tức thì (tránh đơ máy)
        }, (metadata) => {
          setProgress(Math.round(metadata.percent));
        });

        const zipFile = new File([zipBlob], `${folderName}.zip`, { type: "application/zip" });
        filesToProcess = [zipFile];
      }

      setStatus("uploading")
      setProgress(0)

      const totalBytes = filesToProcess.reduce((acc, f) => acc + f.size, 0)
      loadedBytesRef.current = new Array(filesToProcess.length).fill(0)
      
      let hasError = false
      let currentIndex = 0
      let localCompleted = 0
      const CONCURRENCY = 5 // Giảm xuống 5 để tránh quá tải Google API
      const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks cho file siêu lớn

      const uploadNext = async (): Promise<void> => {
        if (hasError || currentIndex >= filesToProcess.length) return
        
        const i = currentIndex++
        const currentFile = filesToProcess[i]
        const fileName = currentFile.webkitRelativePath || currentFile.name

        let attempt = 0;
        let success = false;
        let lastErr: any;

        while (attempt < 3 && !success && !hasError) {
          attempt++;
          try {
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

            if (!initRes.ok) throw new Error(`Không thể khởi tạo tải lên cho ${currentFile.name}`)
            const { uploadUrl } = await initRes.json()

            // 2. Tải file lên
            let uploadedBytes = 0;
            let fileId = "";

            if (currentFile.size === 0) {
              // Xử lý riêng cho file 0-byte (thường gặp trong các thư mục source code)
              fileId = await new Promise<string>((resolve, reject) => {
                const xhr = new XMLHttpRequest()
                activeXhrsRef.current.add(xhr)

                xhr.upload.addEventListener("progress", (event) => {
                  if (event.lengthComputable && totalBytes > 0) {
                    loadedBytesRef.current[i] = event.loaded
                    const currentOverallUploaded = loadedBytesRef.current.reduce((a, b) => a + b, 0)
                    const percentComplete = Math.round((currentOverallUploaded / totalBytes) * 100)
                    setProgress(percentComplete > 100 ? 100 : percentComplete)
                  }
                })

                xhr.addEventListener("load", () => {
                  activeXhrsRef.current.delete(xhr)
                  if (xhr.status === 200 || xhr.status === 201) {
                    const response = JSON.parse(xhr.responseText)
                    resolve(response.id)
                  } else {
                    reject(new Error("Lỗi khi tải file rỗng lên Google Drive"))
                  }
                })

                xhr.addEventListener("error", () => {
                  activeXhrsRef.current.delete(xhr)
                  reject(new Error("Lỗi kết nối mạng"))
                })
                xhr.addEventListener("abort", () => {
                  activeXhrsRef.current.delete(xhr)
                  reject(new Error("Đã hủy tải lên"))
                })

                xhr.open("PUT", uploadUrl, true)
                xhr.setRequestHeader("Content-Type", currentFile.type || "application/octet-stream")
                xhr.send(currentFile)
              })
            } else {
              // Xử lý chunking cho file có dữ liệu
              while (uploadedBytes < currentFile.size) {
                if (hasError) break;

                const chunkEnd = Math.min(uploadedBytes + CHUNK_SIZE, currentFile.size);
                const chunk = currentFile.slice(uploadedBytes, chunkEnd);

                fileId = await new Promise<string>((resolve, reject) => {
                  const xhr = new XMLHttpRequest()
                  activeXhrsRef.current.add(xhr)

                  xhr.upload.addEventListener("progress", (event) => {
                    if (event.lengthComputable && totalBytes > 0) {
                      loadedBytesRef.current[i] = uploadedBytes + event.loaded
                      const currentOverallUploaded = loadedBytesRef.current.reduce((a, b) => a + b, 0)
                      const percentComplete = Math.round((currentOverallUploaded / totalBytes) * 100)
                      setProgress(percentComplete > 100 ? 100 : percentComplete)
                    }
                  })

                  xhr.addEventListener("load", () => {
                    activeXhrsRef.current.delete(xhr)
                    if (xhr.status === 308) {
                      resolve("incomplete") 
                    } else if (xhr.status === 200 || xhr.status === 201) {
                      const response = JSON.parse(xhr.responseText)
                      resolve(response.id)
                    } else {
                      reject(new Error("Lỗi khi tải mảnh dữ liệu lên Google Drive"))
                    }
                  })

                  xhr.addEventListener("error", () => {
                    activeXhrsRef.current.delete(xhr)
                    reject(new Error("Lỗi kết nối mạng"))
                  })
                  xhr.addEventListener("abort", () => {
                    activeXhrsRef.current.delete(xhr)
                    reject(new Error("Đã hủy tải lên"))
                  })

                  xhr.open("PUT", uploadUrl, true)
                  xhr.setRequestHeader("Content-Type", currentFile.type || "application/octet-stream")
                  xhr.setRequestHeader("Content-Range", `bytes ${uploadedBytes}-${chunkEnd - 1}/${currentFile.size}`)
                  xhr.send(chunk)
                })

                uploadedBytes = chunkEnd;
              }
            }

            if (hasError) return;

            loadedBytesRef.current[i] = currentFile.size
            if (totalBytes > 0) {
              const currentOverallUploaded = loadedBytesRef.current.reduce((a, b) => a + b, 0)
              setProgress(Math.round((currentOverallUploaded / totalBytes) * 100))
            }

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

            if (!confirmRes.ok) throw new Error(`Lỗi khi lưu thông tin tài liệu ${currentFile.name}`)

            success = true;
          } catch (err: any) {
            lastErr = err;
            if (err.message === "Đã hủy tải lên") {
              hasError = true;
              throw err;
            }
            // Nếu lỗi, đợi 1 khoảng thời gian tỷ lệ thuận với số lần thử lại trước khi retry
            if (attempt < 3) {
              await new Promise(r => setTimeout(r, 1500 * attempt));
            }
          }
        } // end while retry

        if (!success && !hasError) {
          hasError = true;
          throw lastErr;
        }

        if (success) {
          localCompleted++
          setCompletedCount(localCompleted)
          await uploadNext()
        }
      }

      // Start workers
      const workers = []
      for (let w = 0; w < CONCURRENCY; w++) {
        workers.push(uploadNext())
      }
      
      await Promise.all(workers)

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

  const isFolderUpload = files.length > 0 && files[0].webkitRelativePath !== ""
  const folderName = isFolderUpload ? files[0].webkitRelativePath.split('/')[0] : ""
  const totalSizeMB = (files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)

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
            setCompletedCount(0)
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
          disabled={status === "uploading" || status === "zipping"}
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
          disabled={status === "uploading" || status === "zipping"}
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
                <FileIcon className="w-4 h-4" /> Chọn File
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
              {isFolderUpload || files.length > 1 ? <Folder className="w-8 h-8" /> : <FileIcon className="w-8 h-8" />}
            </div>
            <p className="font-medium text-slate-900 dark:text-white truncate max-w-xs">
              {isFolderUpload ? `Thư mục: ${folderName}` : files.length === 1 ? files[0].name : `Đã chọn ${files.length} file`}
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Tổng dung lượng: {totalSizeMB} MB ({files.length} mục)
            </p>
            
            {status === "zipping" && (
              <div className="w-full max-w-xs mb-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span className="truncate max-w-[200px]">Đang đóng gói ZIP thư mục...</span>
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

            {status === "uploading" && (
              <div className="w-full max-w-xs mb-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span className="truncate max-w-[200px]">
                    {isFolderUpload ? "Đang tải file ZIP lên Drive..." : `Đang tải (${Math.min(completedCount + 1, files.length)}/${files.length})...`}
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
                disabled={status === "uploading" || status === "zipping" || status === "success"}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50"
              >
                {(status === "uploading" || status === "zipping") && <Loader2 className="w-4 h-4 animate-spin" />}
                {status === "uploading" ? "Đang xử lý..." : status === "zipping" ? "Đang đóng gói..." : "Tải lên & Đồng bộ"}
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
