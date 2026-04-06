export default function AuthCard() {
  return (
    <aside className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-green-600 font-black text-white">
          GS
        </span>
        <p className="text-lg font-bold tracking-tight text-slate-900">GoSeller</p>
      </div>

      <p className="text-sm leading-relaxed text-slate-600">
        Sign in to discover storefronts and start monetizing your audience.
      </p>

      <form className="mt-5 space-y-3" action="#" method="post">
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="name@domain.com"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 transition focus:border-emerald-500"
        />

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          Continue
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-100" />
        <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Or</span>
        <span className="h-px flex-1 bg-slate-100" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button type="button" className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Google</button>
        <button type="button" className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Apple</button>
        <button type="button" className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">Discord</button>
      </div>
    </aside>
  );
}
