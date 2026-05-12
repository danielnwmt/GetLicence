// Shim com a mesma superfície do supabase-js que o app Lovable usa,
// mas falando com o backend Express local em /api/*.
// Suporta: auth.{getSession, onAuthStateChange, signInWithPassword, signOut, updateUser}
//         from(table).select/insert/update/delete/eq/order/single/maybeSingle

type Session = { user: { id: string; email: string } } | null;
type Listener = (event: string, session: Session) => void;

const state: { session: Session; listeners: Set<Listener> } = {
  session: null,
  listeners: new Set(),
};

async function req<T = any>(method: string, path: string, body?: unknown): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const res = await fetch(path, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) return { data: null, error: { message: data?.error || `HTTP ${res.status}` } };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : "Erro de rede" } };
  }
}

function notify(event: string) {
  for (const l of state.listeners) l(event, state.session);
}

class Query<T = any> {
  private filters: { col: string; op: string; val: unknown }[] = [];
  private orderCol?: string;
  private orderAsc = true;
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: unknown;
  private cols = "*";
  private selectChain = false;
  private wantSingle = false;
  private wantMaybeSingle = false;

  constructor(private table: string) {}

  select(cols = "*") {
    this.cols = cols;
    this.selectChain = true;
    return this;
  }
  insert(values: unknown) {
    this.mode = "insert";
    this.payload = values;
    return this;
  }
  update(values: unknown) {
    this.mode = "update";
    this.payload = values;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(col: string, val: unknown) { this.filters.push({ col, op: "eq", val }); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  single() { this.wantSingle = true; return this.run(); }
  maybeSingle() { this.wantMaybeSingle = true; return this.run(); }

  private async run(): Promise<{ data: any; error: { message: string } | null }> {
    const q = new URLSearchParams();
    q.set("cols", this.cols);
    if (this.orderCol) q.set("order", `${this.orderCol}.${this.orderAsc ? "asc" : "desc"}`);
    for (const f of this.filters) q.set(`f_${f.col}`, `${f.op}.${f.val}`);
    const url = `/api/db/${encodeURIComponent(this.table)}?${q.toString()}`;
    let r: { data: any; error: { message: string } | null };
    if (this.mode === "select") r = await req("GET", url);
    else if (this.mode === "insert") r = await req("POST", url, { values: this.payload, returning: this.selectChain });
    else if (this.mode === "update") r = await req("PATCH", url, { values: this.payload, returning: this.selectChain });
    else r = await req("DELETE", url);
    if (r.error) return r;
    let data = r.data;
    if (this.wantSingle || this.wantMaybeSingle) {
      if (Array.isArray(data)) data = data[0] ?? null;
      if (this.wantSingle && !data) return { data: null, error: { message: "Registro não encontrado" } };
    }
    return { data, error: null };
  }

  // permite `await query` sem chamar single/maybeSingle
  then<TResult1 = any>(onFulfilled?: (v: { data: any; error: any }) => TResult1) {
    return this.run().then(onFulfilled);
  }
}

async function loadSession() {
  const r = await req<{ user: { id: string; email: string } | null }>("GET", "/api/auth/me");
  state.session = r.data?.user ? { user: r.data.user } : null;
  return state.session;
}

export const supabase = {
  auth: {
    async getSession() {
      const s = await loadSession();
      return { data: { session: s }, error: null };
    },
    onAuthStateChange(cb: Listener) {
      state.listeners.add(cb);
      // dispara estado atual de forma assíncrona
      queueMicrotask(() => cb("INITIAL_SESSION", state.session));
      return { data: { subscription: { unsubscribe: () => state.listeners.delete(cb) } } };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const r = await req("POST", "/api/auth/login", { email, password });
      if (r.error) return { data: null, error: r.error };
      await loadSession();
      notify("SIGNED_IN");
      return { data: { session: state.session }, error: null };
    },
    async signOut() {
      await req("POST", "/api/auth/logout");
      state.session = null;
      notify("SIGNED_OUT");
      return { error: null };
    },
    async updateUser(payload: { email?: string; password?: string }) {
      const r = await req("POST", "/api/auth/update-user", payload);
      return r.error ? { data: null, error: r.error } : { data: { user: state.session?.user }, error: null };
    },
  },
  from<T = any>(table: string) {
    return new Query<T>(table);
  },
};

export type Database = unknown;
