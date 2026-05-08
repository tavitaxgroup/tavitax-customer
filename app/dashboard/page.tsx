import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { UploadZone } from "@/components/UploadZone"
import { Clock, CheckCircle, FileText, Loader, ExternalLink } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()
  
  const documents = await prisma.document.findMany({
    where: { userId: session?.user?.id },
    orderBy: { createdAt: 'desc' }
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "UPLOADED": return <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3"/> Đã tải lên</span>
      case "RECEIVED": return <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Đã tiếp nhận</span>
      case "PROCESSING": return <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium flex items-center gap-1"><Loader className="w-3 h-3 animate-spin"/> Đang xử lý</span>
      case "COMPLETED": return <span className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Hoàn thành</span>
      default: return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">{status}</span>
    }
  }

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Xin chào, {session?.user?.name}!</h1>
      
      <UploadZone />
      
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tài liệu của bạn</h2>
        </div>
        
        {documents.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p>Chưa có tài liệu nào. Hãy tải lên tài liệu đầu tiên của bạn!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {documents.map((doc) => (
              <div key={doc.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/50 text-brand-600 dark:text-brand-400 rounded-lg flex items-center justify-center shrink-0 mt-1 md:mt-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900 dark:text-white">{doc.name}</h3>
                    <div className="text-sm text-slate-500 flex items-center gap-3 mt-1">
                      <span>{(doc.size / 1024 / 1024).toFixed(2)} MB</span>
                      <span>•</span>
                      <span>{doc.createdAt.toLocaleDateString("vi-VN", { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 ml-14 md:ml-0">
                  {getStatusBadge(doc.status)}
                  {doc.driveLink && (
                    <a 
                      href={doc.driveLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 text-sm font-medium transition-colors"
                    >
                      Mở Drive <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
