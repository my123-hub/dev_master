// 招聘页（FR-35~38）：分类 Tab（社会/校园）+ 职位卡片（急招标签）+ 职位详情 + 投递简历表单（FR-37）
// 数据：GET /api/jobs /api/jobs/{id}；投递 POST /api/jobs/{id}/apply（multipart，PDF/Word ≤10MB）
import { useEffect, useState } from 'react'
import {
  fetchJobDetail,
  fetchJobs,
  submitApplication,
  type JobDetail,
  type JobItem,
} from '@/lib/api'
import { PageHeader, SkeletonBar, EmptyState } from '@/components/Skeleton'

/** 投递表单弹层：姓名、电话、邮箱、简历附件、自我推荐 + 成功反馈（FR-37） */
function ApplyModal({ job, onClose }: { job: JobDetail; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', note: '' })
  const [resume, setResume] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  // 手机号正则（与后端一致 ^1[3-9]\d{9}$）
  const phoneOk = /^1[3-9]\d{9}$/.test(form.phone)
  // 简历类型校验（PDF/Word，前端预校验，后端二次校验）
  const resumeOk = resume && /\.(pdf|doc|docx)$/i.test(resume.name)
  const resumeSizeOk = resume && resume.size <= 10 * 1024 * 1024

  const canSubmit = form.name.trim() && phoneOk && resumeOk && resumeSizeOk && !submitting

  const handleSubmit = async () => {
    if (!resume) return
    setError('')
    setSubmitting(true)
    try {
      await submitApplication(job.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        resume,
        note: form.note.trim() || undefined,
      })
      setDone('投递成功，我们将在 1-3 个工作日内与您联系')
    } catch (e: any) {
      setError(e?.message || '投递失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-jade-900/60 backdrop-blur-sm" onClick={done ? onClose : undefined} />
      <div className="relative bg-white rounded-card shadow-card-hover w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-warmgray-100 px-7 py-5 flex items-center justify-between">
          <h2 className="font-serif text-xl text-jade-700 font-semibold">投递简历 · {job.title}</h2>
          <button onClick={onClose} className="text-warmgray-500 hover:text-jade-700 text-xl leading-none" aria-label="关闭">
            ×
          </button>
        </div>

        <div className="p-7">
          {done ? (
            /* 成功反馈（FR-37） */
            <div className="text-center py-10">
              <div className="mx-auto w-16 h-16 rounded-full bg-jade-50 border-2 border-jade-200 flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F5A42" strokeWidth="2">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-jade-700 font-medium">{done}</p>
              <button onClick={onClose} className="btn-primary mt-6 !px-6 !py-2.5">
                完成
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {error && <div className="text-red-600 text-sm bg-red-50 rounded-lg px-4 py-2.5">{error}</div>}

              {/* 姓名 */}
              <div>
                <label className="label">姓名 <span className="text-gold-600">*</span></label>
                <input
                  className="input"
                  value={form.name}
                  maxLength={50}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="请输入您的姓名"
                />
              </div>

              {/* 电话 */}
              <div>
                <label className="label">手机号 <span className="text-gold-600">*</span></label>
                <input
                  className="input"
                  value={form.phone}
                  maxLength={11}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                  placeholder="11 位手机号"
                />
                {form.phone && !phoneOk && <p className="text-xs text-red-500 mt-1">手机号格式不正确</p>}
              </div>

              {/* 邮箱 */}
              <div>
                <label className="label">邮箱</label>
                <input
                  className="input"
                  value={form.email}
                  maxLength={100}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="选填"
                />
              </div>

              {/* 简历附件 */}
              <div>
                <label className="label">简历附件 <span className="text-gold-600">*</span></label>
                <label className="flex items-center justify-between border border-dashed border-warmgray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-jade-500 transition-colors">
                  <span className="text-sm text-warmgray-700 truncate">
                    {resume ? resume.name : '选择文件（PDF / Word，≤10MB）'}
                  </span>
                  <span className="text-jade-700 text-sm flex-none">选择文件</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setResume(e.target.files?.[0] ?? null)}
                  />
                </label>
                {resume && !resumeOk && <p className="text-xs text-red-500 mt-1">仅支持 PDF / Word 格式</p>}
                {resume && resumeOk && !resumeSizeOk && <p className="text-xs text-red-500 mt-1">文件不能超过 10MB</p>}
              </div>

              {/* 自我推荐 */}
              <div>
                <label className="label">自我推荐</label>
                <textarea
                  className="input !min-h-[90px] resize-y"
                  value={form.note}
                  maxLength={1000}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="简要介绍您的经验与优势（选填）"
                />
              </div>

              {/* 隐私提示（NFR-10 最小化收集） */}
              <p className="text-xs text-warmgray-500 leading-5">
                提交即表示您同意我们为招聘目的收集并使用以上信息，仅用于本次招聘流程，我们承诺严格保密。
              </p>

              <button className="btn-primary w-full" disabled={!canSubmit} onClick={handleSubmit}>
                {submitting ? '提交中…' : '提交简历'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Jobs() {
  const [category, setCategory] = useState<number | undefined>()
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [applyJob, setApplyJob] = useState<JobDetail | null>(null)
  const [detailJob, setDetailJob] = useState<JobDetail | null>(null)
  const [fetchingDetail, setFetchingDetail] = useState(false)

  // 职位列表（分类 Tab 切换，FR-35）
  useEffect(() => {
    setLoading(true)
    fetchJobs(category)
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false))
  }, [category])

  // 打开详情：拉取富文本职责/要求
  const openDetail = async (job: JobItem) => {
    setFetchingDetail(true)
    setDetailJob(null)
    try {
      setDetailJob(await fetchJobDetail(job.id))
    } catch {
      setDetailJob(job as JobDetail)
    } finally {
      setFetchingDetail(false)
    }
  }

  // 打开投递：直接使用详情数据（缺字段时拉取）
  const openApply = async (job: JobItem) => {
    setApplyJob({ ...job, responsibility: null, requirement: null, contact: '' } as JobDetail)
    try {
      setApplyJob(await fetchJobDetail(job.id))
    } catch {
      /* 已用兜底 */
    }
  }

  return (
    <div>
      <PageHeader tag="CAREERS" title="加入我们" subtitle="与 STK 一起，创造本然之美的居住空间" />

      <div className="container-site py-12 max-w-5xl">
        {/* 分类 Tab（FR-35） */}
        <div className="flex justify-center gap-2 mb-10">
          <button
            className={`px-6 py-2 rounded-full text-sm transition-colors ${
              !category ? 'bg-jade-700 text-white' : 'bg-white text-warmgray-700 border border-warmgray-100 hover:border-jade-500'
            }`}
            onClick={() => setCategory(undefined)}
          >
            全部职位
          </button>
          <button
            className={`px-6 py-2 rounded-full text-sm transition-colors ${
              category === 1 ? 'bg-jade-700 text-white' : 'bg-white text-warmgray-700 border border-warmgray-100 hover:border-jade-500'
            }`}
            onClick={() => setCategory(1)}
          >
            社会招聘
          </button>
          <button
            className={`px-6 py-2 rounded-full text-sm transition-colors ${
              category === 2 ? 'bg-jade-700 text-white' : 'bg-white text-warmgray-700 border border-warmgray-100 hover:border-jade-500'
            }`}
            onClick={() => setCategory(2)}
          >
            校园招聘
          </button>
        </div>

        {/* 职位卡片列表 */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-card shadow-card p-6 space-y-3">
                <SkeletonBar className="h-6 w-1/3" />
                <SkeletonBar className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState text="该分类暂无招聘职位" />
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-jade-700 text-lg font-semibold">{job.title}</h3>
                    {job.is_urgent === 1 && (
                      <span className="text-[11px] bg-red-50 text-red-600 border border-red-100 rounded-full px-2.5 py-0.5">急招</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-warmgray-500">
                    <span>{job.location}</span>
                    {job.job_type && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-warmgray-300 self-center" />
                        <span>{job.job_type}</span>
                      </>
                    )}
                    {job.salary_range && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-warmgray-300 self-center" />
                        <span className="text-gold-600">{job.salary_range}</span>
                      </>
                    )}
                    <span>发布于 {job.created_date}</span>
                  </div>
                </div>
                <div className="flex gap-3 flex-none">
                  <button className="btn-outline !px-5 !py-2" onClick={() => openDetail(job)}>
                    查看详情
                  </button>
                  <button className="btn-primary !px-5 !py-2" onClick={() => openApply(job)}>
                    投递简历
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 职位详情弹层 */}
      {detailJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-jade-900/60 backdrop-blur-sm" onClick={() => setDetailJob(null)} />
          <div className="relative bg-white rounded-card shadow-card-hover w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-warmgray-100 px-7 py-5 flex items-center justify-between">
              <h2 className="font-serif text-xl text-jade-700 font-semibold">
                {detailJob.title}
                {detailJob.is_urgent === 1 && <span className="ml-2 text-[11px] bg-red-50 text-red-600 rounded-full px-2 py-0.5 align-middle">急招</span>}
              </h2>
              <button onClick={() => setDetailJob(null)} className="text-warmgray-500 hover:text-jade-700 text-xl leading-none" aria-label="关闭">
                ×
              </button>
            </div>
            <div className="p-7">
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-warmgray-500 mb-6 pb-6 border-b border-warmgray-100">
                <span>📍 {detailJob.location}</span>
                {detailJob.job_type && <span>类型：{detailJob.job_type}</span>}
                {detailJob.salary_range && <span className="text-gold-600">薪资：{detailJob.salary_range}</span>}
              </div>
              {fetchingDetail ? (
                <div className="space-y-3">
                  <SkeletonBar className="h-4 w-full" />
                  <SkeletonBar className="h-4 w-5/6" />
                </div>
              ) : (
                <>
                  {/* 岗位职责富文本 */}
                  {detailJob.responsibility && (
                    <section className="mb-6">
                      <h3 className="font-serif text-jade-700 font-semibold mb-2">岗位职责</h3>
                      <div className="rich-text" dangerouslySetInnerHTML={{ __html: detailJob.responsibility }} />
                    </section>
                  )}
                  {/* 任职要求富文本 */}
                  {detailJob.requirement && (
                    <section className="mb-6">
                      <h3 className="font-serif text-jade-700 font-semibold mb-2">任职要求</h3>
                      <div className="rich-text" dangerouslySetInnerHTML={{ __html: detailJob.requirement }} />
                    </section>
                  )}
                  <p className="text-sm text-warmgray-500">
                    如有疑问请联系：<span className="text-jade-700">{detailJob.contact}</span>
                  </p>
                </>
              )}
              <button className="btn-primary w-full mt-6" onClick={() => { setDetailJob(null); setApplyJob(detailJob) }}>
                投递该职位
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 投递表单弹层 */}
      {applyJob && <ApplyModal job={applyJob} onClose={() => setApplyJob(null)} />}
    </div>
  )
}
