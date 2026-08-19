// 联系我们页（FR-43~50）：联系信息（地址/电话/邮箱）+ 地图 iframe + 在线预约表单 + 留言表单
// 预约：姓名*/手机号校验/预约时间/意向/备注（无门店选择，FR-43）+ 隐私提示 + 成功提示（FR-46）
// 留言：姓名*/电话*/邮箱/内容（FR-47~50）
import { useEffect, useState } from 'react'
import {
  fetchPublicConfig,
  fetchStore,
  submitAppointment,
  submitMessage,
  type PublicConfig,
  type StoreInfo,
} from '@/lib/api'
import { PageHeader, SkeletonBar } from '@/components/Skeleton'

// 预约表单（FR-43~46）
function AppointmentForm() {
  const [form, setForm] = useState({ name: '', phone: '', appointment_date: '', intention: '', remark: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [agreed, setAgreed] = useState(false)

  const phoneOk = /^1[3-9]\d{9}$/.test(form.phone)
  const canSubmit = form.name.trim() && phoneOk && agreed && !submitting

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      await submitAppointment({
        name: form.name.trim(),
        phone: form.phone.trim(),
        appointment_date: form.appointment_date.trim() || undefined,
        intention: form.intention.trim() || undefined,
        remark: form.remark.trim() || undefined,
      })
      setDone('预约成功，我们将在 1-2 个工作日内与您联系')
    } catch (e: any) {
      setError(e?.message || '预约失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto w-16 h-16 rounded-full bg-jade-50 border-2 border-jade-200 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F5A42" strokeWidth="2">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-jade-700 font-medium">{done}</p>
        <button
          className="btn-outline mt-6 !px-6 !py-2.5"
          onClick={() => {
            setDone('')
            setForm({ name: '', phone: '', appointment_date: '', intention: '', remark: '' })
          }}
        >
          再预约一次
        </button>
      </div>
    )
  }

  return (
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
          placeholder="您的称呼"
        />
      </div>
      {/* 手机号 */}
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
      {/* 预约到店时间 */}
      <div>
        <label className="label">预约到店时间</label>
        <input
          className="input"
          type="datetime-local"
          value={form.appointment_date}
          onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
        />
      </div>
      {/* 意向产品/系列 */}
      <div>
        <label className="label">意向产品/系列</label>
        <input
          className="input"
          value={form.intention}
          maxLength={200}
          onChange={(e) => setForm({ ...form, intention: e.target.value })}
          placeholder="如：餐桌系列 / 全屋定制"
        />
      </div>
      {/* 备注 */}
      <div>
        <label className="label">备注</label>
        <textarea
          className="input !min-h-[70px] resize-y"
          value={form.remark}
          maxLength={500}
          onChange={(e) => setForm({ ...form, remark: e.target.value })}
          placeholder="想了解的具体内容（选填）"
        />
      </div>
      {/* 隐私提示勾选（NFR-10 合规） */}
      <label className="flex items-start gap-2 text-xs text-warmgray-500 leading-5 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-jade-700"
        />
        <span>
          我已阅读并同意<a href="/about" className="text-jade-700 underline underline-offset-2">《隐私政策》</a>，同意为预约服务收集以上信息，仅用于门店服务联系。
        </span>
      </label>
      <button className="btn-primary w-full" disabled={!canSubmit} onClick={handleSubmit}>
        {submitting ? '提交中…' : '提交预约'}
      </button>
    </div>
  )
}

// 留言表单（FR-47~50）
function MessageForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', content: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [agreed, setAgreed] = useState(false)

  const phoneOk = /^1[3-9]\d{9}$/.test(form.phone)
  const emailOk = !form.email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)
  const canSubmit = form.name.trim() && phoneOk && form.content.trim() && emailOk && agreed && !submitting

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      await submitMessage({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        content: form.content.trim(),
      })
      setDone('留言成功，我们将尽快与您联系')
    } catch (e: any) {
      setError(e?.message || '留言失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto w-16 h-16 rounded-full bg-jade-50 border-2 border-jade-200 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F5A42" strokeWidth="2">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-jade-700 font-medium">{done}</p>
        <button
          className="btn-outline mt-6 !px-6 !py-2.5"
          onClick={() => {
            setDone('')
            setForm({ name: '', phone: '', email: '', content: '' })
          }}
        >
          继续留言
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-red-600 text-sm bg-red-50 rounded-lg px-4 py-2.5">{error}</div>}
      <div>
        <label className="label">姓名 <span className="text-gold-600">*</span></label>
        <input
          className="input"
          value={form.name}
          maxLength={50}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="您的称呼"
        />
      </div>
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
      <div>
        <label className="label">邮箱</label>
        <input
          className="input"
          value={form.email}
          maxLength={100}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="选填"
        />
        {form.email && !emailOk && <p className="text-xs text-red-500 mt-1">邮箱格式不正确</p>}
      </div>
      <div>
        <label className="label">留言内容 <span className="text-gold-600">*</span></label>
        <textarea
          className="input !min-h-[100px] resize-y"
          value={form.content}
          maxLength={2000}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder="想咨询的问题或建议"
        />
      </div>
      <label className="flex items-start gap-2 text-xs text-warmgray-500 leading-5 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-jade-700"
        />
        <span>
          我已阅读并同意<a href="/about" className="text-jade-700 underline underline-offset-2">《隐私政策》</a>，同意为回复留言收集以上信息。
        </span>
      </label>
      <button className="btn-primary w-full" disabled={!canSubmit} onClick={handleSubmit}>
        {submitting ? '提交中…' : '提交留言'}
      </button>
    </div>
  )
}

export default function Contact() {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchPublicConfig(), fetchStore()])
      .then(([c, s]) => {
        setConfig(c)
        setStore(s)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const contact = config?.contact
  const storeInfo = store

  return (
    <div>
      <PageHeader tag="CONTACT" title="联系我们" subtitle="欢迎预约到店或在线留言，我们将在 1-2 个工作日内与您联系" />

      <div className="container-site py-12 max-w-6xl">
        {/* 联系信息卡（FR-47） */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          <div className="card p-6 text-center">
            <div className="mx-auto w-11 h-11 rounded-full bg-jade-50 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F5A42" strokeWidth="1.6">
                <path d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            </div>
            <div className="text-sm text-warmgray-500">门店地址</div>
            <div className="mt-1 text-warmgray-900 font-medium">
              {loading ? '加载中…' : storeInfo ? `${storeInfo.city} ${storeInfo.address}` : contact?.address || '—'}
            </div>
          </div>
          <div className="card p-6 text-center">
            <div className="mx-auto w-11 h-11 rounded-full bg-jade-50 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F5A42" strokeWidth="1.6">
                <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.9.6 2.9.7a2 2 0 011.7 2z" />
              </svg>
            </div>
            <div className="text-sm text-warmgray-500">联系电话</div>
            <div className="mt-1 text-warmgray-900 font-medium">
              {loading ? '加载中…' : storeInfo?.phone || contact?.phone || '—'}
            </div>
          </div>
          <div className="card p-6 text-center">
            <div className="mx-auto w-11 h-11 rounded-full bg-jade-50 flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F5A42" strokeWidth="1.6">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </svg>
            </div>
            <div className="text-sm text-warmgray-500">电子邮箱</div>
            <div className="mt-1 text-warmgray-900 font-medium">{contact?.email || '—'}</div>
          </div>
        </div>

        {/* 地图 iframe（FR-48：官方地图 URI 嵌入，合规无 key）+ 营业时间 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-12">
          <div className="lg:col-span-3 rounded-card overflow-hidden shadow-card border border-warmgray-100">
            <iframe
              title="STK 本然家居 · 上海旗舰店"
              src="https://uri.amap.com/marker?position=121.4737,31.2304&name=STK本然家居·上海旗舰店&coordinate=gaode&callnative=0"
              className="w-full h-[360px] border-0"
              loading="lazy"
            />
          </div>
          <div className="lg:col-span-2 card p-7">
            <h2 className="font-serif text-jade-700 text-lg font-semibold mb-4">{storeInfo?.name || '上海旗舰店'}</h2>
            {loading ? (
              <div className="space-y-3">
                <SkeletonBar className="h-4 w-full" />
                <SkeletonBar className="h-4 w-3/4" />
              </div>
            ) : (
              <ul className="space-y-3 text-sm text-warmgray-700">
                <li className="flex gap-3">
                  <span className="text-jade-700 flex-none">地址</span>
                  <span>{storeInfo ? `${storeInfo.city} ${storeInfo.address}` : contact?.address}</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-jade-700 flex-none">电话</span>
                  <a href={`tel:${storeInfo?.phone || contact?.phone}`} className="hover:text-gold-600">
                    {storeInfo?.phone || contact?.phone}
                  </a>
                </li>
                {storeInfo?.business_hours && (
                  <li className="flex gap-3">
                    <span className="text-jade-700 flex-none">营业时间</span>
                    <span>{storeInfo.business_hours}</span>
                  </li>
                )}
                <li className="flex gap-3">
                  <span className="text-jade-700 flex-none">邮箱</span>
                  <a href={`mailto:${contact?.email}`} className="hover:text-gold-600">
                    {contact?.email}
                  </a>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* 表单区：在线预约 + 在线留言（两列） */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="card p-8">
            <h2 className="font-serif text-jade-700 text-xl font-semibold mb-1">在线预约</h2>
            <p className="text-sm text-warmgray-500 mb-6">预约到店体验（无门店选择，默认上海旗舰店）</p>
            <AppointmentForm />
          </div>
          <div className="card p-8">
            <h2 className="font-serif text-jade-700 text-xl font-semibold mb-1">在线留言</h2>
            <p className="text-sm text-warmgray-500 mb-6">留下您的咨询，我们将尽快回复</p>
            <MessageForm />
          </div>
        </div>
      </div>
    </div>
  )
}
