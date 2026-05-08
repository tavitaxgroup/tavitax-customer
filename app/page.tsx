import { signIn } from "@/auth"
import { ArrowRight, FileText, Shield, Zap } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-brand-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px] pointer-events-none" />

      <div className="z-10 max-w-5xl w-full px-6 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 mb-8 animate-fade-in-up">
          <span className="flex h-2 w-2 rounded-full bg-brand-500 animate-pulse"></span>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Tavitax Customer Portal</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
          Quản lý tài liệu <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-blue-600">
            Dễ dàng & Bảo mật
          </span>
        </h1>

        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-12 max-w-2xl">
          Cổng thông tin dành riêng cho khách hàng của Tavitax. Gửi tài liệu, theo dõi trạng thái xử lý và tự động đồng bộ an toàn chỉ với vài cú click.
        </p>

        <form
          action={async () => {
            "use server"
            await signIn("google", { redirectTo: "/dashboard" })
          }}
        >
          <button
            type="submit"
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 text-base font-semibold text-white transition-all duration-200 bg-slate-900 dark:bg-white dark:text-slate-900 rounded-full hover:bg-slate-800 dark:hover:bg-slate-100 hover:scale-105 hover:shadow-xl hover:shadow-slate-900/20 active:scale-95"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Đăng nhập với Google
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-left w-full">
          <div className="glass p-6 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center mb-4 text-brand-600 dark:text-brand-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Đồng bộ tức thì</h3>
            <p className="text-slate-600 dark:text-slate-400">Tài liệu tự động tải lên Google Drive của Tavitax ngay khi bạn gửi.</p>
          </div>
          <div className="glass p-6 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Theo dõi trạng thái</h3>
            <p className="text-slate-600 dark:text-slate-400">Biết chính xác tài liệu của bạn đã được tiếp nhận hay đang xử lý.</p>
          </div>
          <div className="glass p-6 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Bảo mật tuyệt đối</h3>
            <p className="text-slate-600 dark:text-slate-400">Đăng nhập an toàn qua tài khoản Google của bạn, không cần nhớ mật khẩu.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
