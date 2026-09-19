import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Code2,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  X,
  Zap
} from "lucide-react";
import { api } from "./api";

type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "DEV_OPS" | "MARKETING_VENDAS_FINANCAS";
  area: string;
};

type DashboardData = {
  stats: {
    projects: number;
    completedProjects: number;
    pendingTasks: number;
    overdueTasks: number;
    leads: number;
    sales: number;
    revenue: number;
    expenses: number;
  };
  monthly: { month: string; revenue: number; expenses: number }[];
  activities: { id: string; user: string; action: string; createdAt: string }[];
};

type TeamUser = User & { createdAt: string };

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  owner?: { name: string } | null;
  tasks?: { id: string; title: string; status: string }[];
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId?: string | null;
  project?: { name: string } | null;
  assigneeId?: string | null;
  assignee?: { name: string } | null;
};

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
};

type Lead = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  status: string;
  value: number;
  client?: Client | null;
};

type Sale = {
  id: string;
  title: string;
  value: number;
  client?: Client | null;
};

type FinanceEntry = {
  id: string;
  description: string;
  value: number;
  date: string;
};

type FinanceData = {
  revenue: FinanceEntry[];
  expense: FinanceEntry[];
  totals: { revenue: number; expense: number; balance: number };
};

type ProductionData = {
  projects: Project[];
  tasks: Task[];
};

type MessageItem = {
  id: string;
  subject: string;
  content: string;
  read: boolean;
  createdAt: string;
  sender?: { id: string; name: string; email: string } | null;
  recipient?: { id: string; name: string; email: string } | null;
};

const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "projects", label: "Projetos", icon: BriefcaseBusiness },
  { id: "tasks", label: "Tarefas", icon: ClipboardList },
  { id: "clients", label: "Clientes", icon: Users },
  { id: "marketing", label: "Marketing", icon: Megaphone, area: "commercial" },
  { id: "sales", label: "Vendas", icon: ShoppingBag, area: "commercial" },
  { id: "finance", label: "Finanças", icon: WalletCards, area: "commercial" },
  { id: "production", label: "Produção", icon: Code2 },
  { id: "team", label: "Equipe", icon: UserRound },
  { id: "messages", label: "Mensagens", icon: MessageSquare },
  { id: "settings", label: "Configurações", icon: Settings }
];

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR");
}

function statusLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await api<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem("webdev_token", result.token);
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-glow glow-one" />
      <div className="login-glow glow-two" />
      <section className="login-card">
        <div className="brand-login">
          <img src="/logo.png" alt="Web Dev" />
        </div>
        <div className="login-heading">
          <span className="eyebrow"><ShieldCheck size={14} /> ÁREA INTERNA</span>
          <h1>Bem-vindo de volta.</h1>
          <p>Acesse o centro de operações da Web Dev.</p>
        </div>

        <form onSubmit={submit} className="login-form">
          <label>
            E-mail
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="seu@email.com" required />
          </label>
          <label>
            Senha
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" required />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-btn" disabled={busy}>
            {busy ? "Entrando..." : "Entrar no painel"}
            <ArrowUpRight size={18} />
          </button>
        </form>

        <div className="login-footer">
          <span><Database size={14} /> PostgreSQL + Neon</span>
          <span><Zap size={14} /> Web Dev OS</span>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  accent
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  accent?: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${accent || ""}`}><Icon size={20} /></div>
      <div className="stat-copy">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function Dashboard({ data, user }: { data: DashboardData; user: User }) {
  const max = Math.max(...data.monthly.map((x) => Math.max(x.revenue, x.expenses)), 1);
  return (
    <div className="content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">VISÃO GERAL</span>
          <h1>Olá, {user.name.split(" ")[0]}.</h1>
          <p>Acompanhe o que está acontecendo na operação hoje.</p>
        </div>
        <div className="live-badge"><span /> Sistema online</div>
      </div>

      <div className="stats-grid">
        <StatCard title="Projetos ativos" value={data.stats.projects} detail={`${data.stats.completedProjects} concluídos`} icon={BriefcaseBusiness} />
        <StatCard title="Tarefas pendentes" value={data.stats.pendingTasks} detail={`${data.stats.overdueTasks} atrasadas`} icon={ClipboardList} accent="purple" />
        <StatCard title="Leads ativos" value={data.stats.leads} detail={`${data.stats.sales} vendas registradas`} icon={TrendingUp} accent="green" />
        <StatCard title="Faturamento" value={money(data.stats.revenue)} detail={`Despesas: ${money(data.stats.expenses)}`} icon={CircleDollarSign} accent="blue" />
      </div>

      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">FINANCEIRO</span>
              <h2>Movimento dos últimos 6 meses</h2>
            </div>
            <div className="legend"><span><i /> Receita</span><span><i className="expense-dot" /> Despesas</span></div>
          </div>
          <div className="chart">
            {data.monthly.map((item) => (
              <div className="chart-col" key={item.month}>
                <div className="bars">
                  <div className="bar revenue" style={{ height: `${Math.max(8, (item.revenue / max) * 100)}%` }} title={money(item.revenue)} />
                  <div className="bar expense" style={{ height: `${Math.max(8, (item.expenses / max) * 100)}%` }} title={money(item.expenses)} />
                </div>
                <span>{item.month}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ATIVIDADE</span>
              <h2>Últimas ações</h2>
            </div>
            <Activity size={18} />
          </div>
          <div className="activity-list">
            {data.activities.length === 0 ? (
              <div className="empty">Nenhuma atividade registrada.</div>
            ) : data.activities.map((activity) => (
              <div className="activity-item" key={activity.id}>
                <div className="activity-avatar">{activity.user.charAt(0)}</div>
                <div>
                  <strong>{activity.user}</strong>
                  <p>{activity.action}</p>
                </div>
                <time>{new Date(activity.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="quick-actions">
        <div><span className="eyebrow">ATALHOS</span><h2>Acesso rápido</h2></div>
        <div className="quick-grid">
          <button><Plus size={17} /> Novo projeto</button>
          <button><Plus size={17} /> Nova tarefa</button>
          <button><Mail size={17} /> Mensagens</button>
          <button><FileText size={17} /> Relatórios</button>
        </div>
      </section>
    </div>
  );
}

function Team({ team }: { team: TeamUser[] }) {
  return (
    <div className="content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">ORGANIZAÇÃO</span>
          <h1>Equipe</h1>
          <p>Usuários e permissões do painel Web Dev.</p>
        </div>
      </div>
      <div className="team-grid">
        {team.map((member) => (
          <div className="team-card" key={member.id}>
            <div className="team-avatar">{member.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div>
            <div className="team-info">
              <h3>{member.name}</h3>
              <p>{member.email}</p>
              <span className={`role-pill ${member.role === "ADMIN" ? "admin" : ""}`}>
                {member.role === "ADMIN" ? "Administrador" : member.area}
              </span>
            </div>
            <div className="team-status"><span /> Ativo</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModuleSection({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">MÓDULO</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ProjectModule({ projects, team, onRefresh }: { projects: Project[]; team: TeamUser[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", status: "PLANEJADO", priority: "MEDIA", dueDate: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { ...form, description: form.description || "", dueDate: form.dueDate || "" };
    if (editingId) {
      await api(`/api/projects/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/projects", { method: "POST", body: JSON.stringify(payload) });
    }
    setForm({ name: "", description: "", status: "PLANEJADO", priority: "MEDIA", dueDate: "" });
    setEditingId(null);
    onRefresh();
  }

  async function remove(id: string) {
    await api(`/api/projects/${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <ModuleSection title="Projetos" subtitle="Acompanhe entregas, prazos e status das entregas." action={<button className="primary-btn compact" type="button" onClick={() => { setEditingId(null); setForm({ name: "", description: "", status: "PLANEJADO", priority: "MEDIA", dueDate: "" }); }}><Plus size={17} /> Novo</button>}>
      <div className="module-hero">
        <div className="module-icon"><BriefcaseBusiness size={28} /></div>
        <div>
          <h2>Operação de projetos</h2>
          <p>Dados reais do backend conectados ao painel.</p>
        </div>
      </div>

      <div className="module-grid">
        <form className="panel form-panel" onSubmit={submit}>
          <h3>{editingId ? "Editar projeto" : "Novo projeto"}</h3>
          <label>Nome<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Descrição<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} /></label>
          <div className="inline-fields">
            <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="PLANEJADO">Planejado</option><option value="EM_ANDAMENTO">Em andamento</option><option value="PAUSADO">Pausado</option><option value="CONCLUIDO">Concluído</option></select></label>
            <label>Prioridade<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option><option value="URGENTE">Urgente</option></select></label>
          </div>
          <label>Prazo<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
          <button className="primary-btn" type="submit">{editingId ? "Salvar alterações" : "Criar projeto"}</button>
        </form>

        <div className="panel">
          <div className="list-stack">
            {projects.length === 0 ? <div className="empty">Nenhum projeto encontrado.</div> : projects.map((project) => (
              <div className="list-row" key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <p>{project.description || "Sem descrição"}</p>
                  <small>{statusLabel(project.status)} • {statusLabel(project.priority)} • {formatDate(project.dueDate)}</small>
                </div>
                <div className="row-actions">
                  <button className="secondary-btn" type="button" onClick={() => { setEditingId(project.id); setForm({ name: project.name, description: project.description || "", status: project.status, priority: project.priority, dueDate: project.dueDate ? new Date(project.dueDate).toISOString().slice(0, 10) : "" }); }}>Editar</button>
                  <button className="danger-btn" type="button" onClick={() => remove(project.id)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModuleSection>
  );
}

function TaskModule({ tasks, projects, team, onRefresh }: { tasks: Task[]; projects: Project[]; team: TeamUser[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", status: "A_FAZER", priority: "MEDIA", dueDate: "", projectId: "", assigneeId: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { ...form, description: form.description || "", dueDate: form.dueDate || "", projectId: form.projectId || "", assigneeId: form.assigneeId || "" };
    if (editingId) {
      await api(`/api/tasks/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
    }
    setForm({ title: "", description: "", status: "A_FAZER", priority: "MEDIA", dueDate: "", projectId: "", assigneeId: "" });
    setEditingId(null);
    onRefresh();
  }

  async function remove(id: string) {
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    onRefresh();
  }

  async function updateStatus(id: string, status: string) {
    await api(`/api/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    onRefresh();
  }

  return (
    <ModuleSection title="Tarefas" subtitle="Organize o trabalho por prioridade e responsável." action={<button className="primary-btn compact" type="button" onClick={() => { setEditingId(null); setForm({ title: "", description: "", status: "A_FAZER", priority: "MEDIA", dueDate: "", projectId: "", assigneeId: "" }); }}><Plus size={17} /> Nova</button>}>
      <div className="module-grid">
        <form className="panel form-panel" onSubmit={submit}>
          <h3>{editingId ? "Editar tarefa" : "Nova tarefa"}</h3>
          <label>Título<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label>Descrição<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} /></label>
          <div className="inline-fields">
            <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="A_FAZER">A fazer</option><option value="EM_ANDAMENTO">Em andamento</option><option value="CONCLUIDA">Concluída</option></select></label>
            <label>Prioridade<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option><option value="URGENTE">Urgente</option></select></label>
          </div>
          <div className="inline-fields">
            <label>Projeto<select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">Sem projeto</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label>Responsável<select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}><option value="">Sem responsável</option>{team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
          </div>
          <label>Prazo<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
          <button className="primary-btn" type="submit">{editingId ? "Salvar alterações" : "Adicionar tarefa"}</button>
        </form>

        <div className="panel">
          <div className="list-stack">
            {tasks.length === 0 ? <div className="empty">Nenhuma tarefa encontrada.</div> : tasks.map((task) => (
              <div className="list-row" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.description || "Sem descrição"}</p>
                  <small>{task.project?.name || "Sem projeto"} • {task.assignee?.name || "Sem responsável"}</small>
                </div>
                <div className="row-actions">
                  <select value={task.status} onChange={(e) => updateStatus(task.id, e.target.value)}>
                    <option value="A_FAZER">A fazer</option>
                    <option value="EM_ANDAMENTO">Em andamento</option>
                    <option value="CONCLUIDA">Concluída</option>
                  </select>
                  <button className="secondary-btn" type="button" onClick={() => { setEditingId(task.id); setForm({ title: task.title, description: task.description || "", status: task.status, priority: task.priority, dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "", projectId: task.projectId || "", assigneeId: task.assigneeId || "" }); }}>Editar</button>
                  <button className="danger-btn" type="button" onClick={() => remove(task.id)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModuleSection>
  );
}

function ClientModule({ clients, onRefresh }: { clients: Client[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", notes: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { ...form, email: form.email || "", phone: form.phone || "", company: form.company || "", notes: form.notes || "" };
    if (editingId) {
      await api(`/api/clients/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/clients", { method: "POST", body: JSON.stringify(payload) });
    }
    setForm({ name: "", email: "", phone: "", company: "", notes: "" });
    setEditingId(null);
    onRefresh();
  }

  async function remove(id: string) {
    await api(`/api/clients/${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <ModuleSection title="Clientes" subtitle="Centralize contatos e relacionamento comercial." action={<button className="primary-btn compact" type="button" onClick={() => { setEditingId(null); setForm({ name: "", email: "", phone: "", company: "", notes: "" }); }}><Plus size={17} /> Novo</button>}>
      <div className="module-grid">
        <form className="panel form-panel" onSubmit={submit}>
          <h3>{editingId ? "Editar cliente" : "Novo cliente"}</h3>
          <label>Nome<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <div className="inline-fields">
            <label>E-mail<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Telefone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          </div>
          <label>Empresa<input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></label>
          <label>Observações<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} /></label>
          <button className="primary-btn" type="submit">{editingId ? "Salvar alterações" : "Cadastrar cliente"}</button>
        </form>

        <div className="panel">
          <div className="list-stack">
            {clients.length === 0 ? <div className="empty">Nenhum cliente encontrado.</div> : clients.map((client) => (
              <div className="list-row" key={client.id}>
                <div>
                  <strong>{client.name}</strong>
                  <p>{client.company || "Sem empresa"}</p>
                  <small>{client.email || "Sem email"} • {client.phone || "Sem telefone"}</small>
                </div>
                <div className="row-actions">
                  <button className="secondary-btn" type="button" onClick={() => { setEditingId(client.id); setForm({ name: client.name, email: client.email || "", phone: client.phone || "", company: client.company || "", notes: client.notes || "" }); }}>Editar</button>
                  <button className="danger-btn" type="button" onClick={() => remove(client.id)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModuleSection>
  );
}

function MarketingModule({ leads, onRefresh }: { leads: Lead[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", company: "", status: "NOVO", value: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { ...form, email: form.email || "", company: form.company || "", value: Number(form.value || 0) };
    if (editingId) {
      await api(`/api/leads/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/leads", { method: "POST", body: JSON.stringify(payload) });
    }
    setForm({ name: "", email: "", company: "", status: "NOVO", value: "" });
    setEditingId(null);
    onRefresh();
  }

  async function remove(id: string) {
    await api(`/api/leads/${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <ModuleSection title="Marketing" subtitle="Acompanhe leads, propostas e oportunidades." action={<button className="primary-btn compact" type="button" onClick={() => { setEditingId(null); setForm({ name: "", email: "", company: "", status: "NOVO", value: "" }); }}><Plus size={17} /> Novo</button>}>
      <div className="module-grid">
        <form className="panel form-panel" onSubmit={submit}>
          <h3>{editingId ? "Editar lead" : "Novo lead"}</h3>
          <label>Nome<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <div className="inline-fields">
            <label>E-mail<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Empresa<input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></label>
          </div>
          <div className="inline-fields">
            <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="NOVO">Novo</option><option value="CONTATO">Contato</option><option value="NEGOCIACAO">Negociação</option><option value="GANHO">Ganho</option><option value="PERDIDO">Perdido</option></select></label>
            <label>Valor<input type="number" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></label>
          </div>
          <button className="primary-btn" type="submit">{editingId ? "Salvar alterações" : "Registrar lead"}</button>
        </form>

        <div className="panel">
          <div className="list-stack">
            {leads.length === 0 ? <div className="empty">Nenhum lead encontrado.</div> : leads.map((lead) => (
              <div className="list-row" key={lead.id}>
                <div>
                  <strong>{lead.name}</strong>
                  <p>{lead.company || "Sem empresa"}</p>
                  <small>{statusLabel(lead.status)} • {money(lead.value)} • {lead.email || "Sem email"}</small>
                </div>
                <div className="row-actions">
                  <button className="secondary-btn" type="button" onClick={() => { setEditingId(lead.id); setForm({ name: lead.name, email: lead.email || "", company: lead.company || "", status: lead.status, value: String(lead.value) }); }}>Editar</button>
                  <button className="danger-btn" type="button" onClick={() => remove(lead.id)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModuleSection>
  );
}

function SalesModule({ sales, onRefresh }: { sales: Sale[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ title: "", value: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { title: form.title, value: Number(form.value || 0) };
    if (editingId) {
      await api(`/api/sales/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/sales", { method: "POST", body: JSON.stringify(payload) });
    }
    setForm({ title: "", value: "" });
    setEditingId(null);
    onRefresh();
  }

  async function remove(id: string) {
    await api(`/api/sales/${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <ModuleSection title="Vendas" subtitle="Registre vendas e acompanhe o pipeline comercial." action={<button className="primary-btn compact" type="button" onClick={() => { setEditingId(null); setForm({ title: "", value: "" }); }}><Plus size={17} /> Nova</button>}>
      <div className="module-grid">
        <form className="panel form-panel" onSubmit={submit}>
          <h3>{editingId ? "Editar venda" : "Nova venda"}</h3>
          <label>Descrição<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label>Valor<input type="number" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required /></label>
          <button className="primary-btn" type="submit">{editingId ? "Salvar alterações" : "Registrar venda"}</button>
        </form>

        <div className="panel">
          <div className="list-stack">
            {sales.length === 0 ? <div className="empty">Nenhuma venda registrada.</div> : sales.map((sale) => (
              <div className="list-row" key={sale.id}>
                <div>
                  <strong>{sale.title}</strong>
                  <p>{sale.client?.company || "Cliente não informado"}</p>
                  <small>{money(sale.value)}</small>
                </div>
                <div className="row-actions">
                  <button className="secondary-btn" type="button" onClick={() => { setEditingId(sale.id); setForm({ title: sale.title, value: String(sale.value) }); }}>Editar</button>
                  <button className="danger-btn" type="button" onClick={() => remove(sale.id)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModuleSection>
  );
}

function FinanceModule({ finance, onRefresh }: { finance: FinanceData | null; onRefresh: () => void }) {
  const [form, setForm] = useState({ type: "revenue", description: "", value: "", date: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { ...form, value: Number(form.value || 0), date: form.date || "" };
    if (editingId) {
      await api(`/api/finance/${form.type}/${editingId}`, { method: "PUT", body: JSON.stringify({ description: payload.description, value: payload.value, date: payload.date }) });
    } else {
      await api("/api/finance", { method: "POST", body: JSON.stringify(payload) });
    }
    setForm({ type: "revenue", description: "", value: "", date: "" });
    setEditingId(null);
    onRefresh();
  }

  async function remove(type: "revenue" | "expense", id: string) {
    await api(`/api/finance/${type}/${id}`, { method: "DELETE" });
    onRefresh();
  }

  const entries = finance ? [...finance.revenue, ...finance.expense].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];

  return (
    <ModuleSection title="Finanças" subtitle="Controle de receitas, despesas e saldo operacional." action={<button className="primary-btn compact" type="button" onClick={() => { setEditingId(null); setForm({ type: "revenue", description: "", value: "", date: "" }); }}><Plus size={17} /> Novo</button>}>
      <div className="finance-summary">
        <div className="metric-box"><span>Receita</span><strong>{money(finance?.totals.revenue ?? 0)}</strong></div>
        <div className="metric-box"><span>Despesas</span><strong>{money(finance?.totals.expense ?? 0)}</strong></div>
        <div className="metric-box"><span>Saldo</span><strong>{money(finance?.totals.balance ?? 0)}</strong></div>
      </div>
      <div className="module-grid">
        <form className="panel form-panel" onSubmit={submit}>
          <h3>{editingId ? "Editar lançamento" : "Novo lançamento"}</h3>
          <label>Tipo<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="revenue">Receita</option><option value="expense">Despesa</option></select></label>
          <label>Descrição<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label>
          <div className="inline-fields">
            <label>Valor<input type="number" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required /></label>
            <label>Data<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          </div>
          <button className="primary-btn" type="submit">{editingId ? "Salvar alterações" : "Registrar"}</button>
        </form>

        <div className="panel">
          <div className="list-stack">
            {entries.length === 0 ? <div className="empty">Nenhum lançamento financeiro.</div> : entries.map((entry) => {
              const kind = finance?.revenue.some((item) => item.id === entry.id) ? "revenue" : "expense";
              return (
                <div className="list-row" key={entry.id}>
                  <div>
                    <strong>{entry.description}</strong>
                    <p>{kind === "revenue" ? "Receita" : "Despesa"}</p>
                    <small>{formatDate(entry.date)} • {money(entry.value)}</small>
                  </div>
                  <div className="row-actions">
                    <button className="secondary-btn" type="button" onClick={() => { setEditingId(entry.id); setForm({ type: kind, description: entry.description, value: String(entry.value), date: new Date(entry.date).toISOString().slice(0, 10) }); }}>Editar</button>
                    <button className="danger-btn" type="button" onClick={() => remove(kind, entry.id)}>Excluir</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ModuleSection>
  );
}

function ProductionModule({ production }: { production: ProductionData | null }) {
  return (
    <ModuleSection title="Produção" subtitle="Acompanhe projetos e tarefas técnicas em execução.">
      <div className="module-grid">
        <div className="panel">
          <h3>Projetos em execução</h3>
          <div className="list-stack">
            {production?.projects.length ? production.projects.map((project) => (
              <div className="list-row" key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <p>{project.owner?.name || "Sem responsável"}</p>
                  <small>{statusLabel(project.status)}</small>
                </div>
              </div>
            )) : <div className="empty">Nenhum projeto em produção.</div>}
          </div>
        </div>

        <div className="panel">
          <h3>Tarefas técnicas</h3>
          <div className="list-stack">
            {production?.tasks.length ? production.tasks.map((task) => (
              <div className="list-row" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.project?.name || "Sem projeto"}</p>
                  <small>{statusLabel(task.status)} • {task.assignee?.name || "Sem responsável"}</small>
                </div>
              </div>
            )) : <div className="empty">Nenhuma tarefa em produção.</div>}
          </div>
        </div>
      </div>
    </ModuleSection>
  );
}

function MessagesModule({ messages, team, onRefresh }: { messages: MessageItem[]; team: TeamUser[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ recipientId: "", subject: "", content: "" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api("/api/messages", { method: "POST", body: JSON.stringify(form) });
    setForm({ recipientId: "", subject: "", content: "" });
    onRefresh();
  }

  return (
    <ModuleSection title="Mensagens" subtitle="Comunicação da equipe e alertas internos.">
      <div className="module-grid">
        <form className="panel form-panel" onSubmit={submit}>
          <h3>Nova mensagem</h3>
          <label>Destinatário<select value={form.recipientId} onChange={(e) => setForm({ ...form, recipientId: e.target.value })}><option value="">Todos</option>{team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
          <label>Assunto<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required /></label>
          <label>Mensagem<textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} required /></label>
          <button className="primary-btn" type="submit">Enviar</button>
        </form>

        <div className="panel">
          <div className="list-stack">
            {messages.length === 0 ? <div className="empty">Nenhuma mensagem.</div> : messages.map((message) => (
              <div className="list-row" key={message.id}>
                <div>
                  <strong>{message.subject}</strong>
                  <p>{message.content}</p>
                  <small>{message.sender?.name || "Sistema"} • {new Date(message.createdAt).toLocaleString("pt-BR")}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModuleSection>
  );
}

function SettingsModule({ user }: { user: User }) {
  const [form, setForm] = useState({ name: user.name, area: user.area });
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api("/api/auth/me", { method: "PUT", body: JSON.stringify({ name: form.name, area: form.area }) });
    setSuccess("Perfil atualizado com sucesso.");
  }

  return (
    <ModuleSection title="Configurações" subtitle="Atualize as informações pessoais da sua conta.">
      <div className="module-grid single-column">
        <form className="panel form-panel" onSubmit={submit}>
          <h3>Perfil</h3>
          <label>Nome<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Área<input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required /></label>
          <button className="primary-btn" type="submit">Salvar perfil</button>
          {success && <div className="success-box">{success}</div>}
        </form>
      </div>
    </ModuleSection>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [production, setProduction] = useState<ProductionData | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("webdev_token");
    if (!token) {
      setLoading(false);
      return;
    }

    api<User>("/api/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem("webdev_token"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    setError("");
    api<DashboardData>("/api/dashboard").then(setDashboard).catch((e) => setError(e.message));
    api<TeamUser[]>("/api/team").then(setTeam).catch((e) => setError(e.message));
    api<Project[]>("/api/projects").then(setProjects).catch((e) => setError(e.message));
    api<Task[]>("/api/tasks").then(setTasks).catch((e) => setError(e.message));
    api<Client[]>("/api/clients").then(setClients).catch((e) => setError(e.message));
    api<Lead[]>("/api/leads").then(setLeads).catch((e) => setError(e.message));
    api<Sale[]>("/api/sales").then(setSales).catch((e) => setError(e.message));
    api<FinanceData>("/api/finance").then(setFinance).catch((e) => setError(e.message));
    api<ProductionData>("/api/production").then(setProduction).catch((e) => setError(e.message));
    api<MessageItem[]>("/api/messages").then(setMessages).catch((e) => setError(e.message));
  }, [user]);

  const refreshModuleData = () => {
    if (!user) return;
    api<Project[]>("/api/projects").then(setProjects).catch((e) => setError(e.message));
    api<Task[]>("/api/tasks").then(setTasks).catch((e) => setError(e.message));
    api<Client[]>("/api/clients").then(setClients).catch((e) => setError(e.message));
    api<Lead[]>("/api/leads").then(setLeads).catch((e) => setError(e.message));
    api<Sale[]>("/api/sales").then(setSales).catch((e) => setError(e.message));
    api<FinanceData>("/api/finance").then(setFinance).catch((e) => setError(e.message));
    api<ProductionData>("/api/production").then(setProduction).catch((e) => setError(e.message));
    api<MessageItem[]>("/api/messages").then(setMessages).catch((e) => setError(e.message));
  };

  const allowedNav = useMemo(() => nav.filter((item) => {
    if (item.area !== "commercial") return true;
    return user?.role === "ADMIN" || user?.role === "MARKETING_VENDAS_FINANCAS";
  }), [user]);

  if (loading) return <div className="loading-screen"><div className="spinner" /> Carregando Web Dev...</div>;
  if (!user) return <Login onLogin={setUser} />;

  const currentNav = allowedNav.find((item) => item.id === page) || allowedNav[0];

  let Content;
  if (page === "dashboard") {
    Content = dashboard ? <Dashboard data={dashboard} user={user} /> : <div className="content"><div className="loading-card"><div className="spinner" /> Carregando dados...</div></div>;
  } else if (page === "team") {
    Content = <Team team={team} />;
  } else if (page === "projects") {
    Content = <ProjectModule projects={projects} team={team} onRefresh={refreshModuleData} />;
  } else if (page === "tasks") {
    Content = <TaskModule tasks={tasks} projects={projects} team={team} onRefresh={refreshModuleData} />;
  } else if (page === "clients") {
    Content = <ClientModule clients={clients} onRefresh={refreshModuleData} />;
  } else if (page === "marketing") {
    Content = <MarketingModule leads={leads} onRefresh={refreshModuleData} />;
  } else if (page === "sales") {
    Content = <SalesModule sales={sales} onRefresh={refreshModuleData} />;
  } else if (page === "finance") {
    Content = <FinanceModule finance={finance} onRefresh={refreshModuleData} />;
  } else if (page === "production") {
    Content = <ProductionModule production={production} />;
  } else if (page === "messages") {
    Content = <MessagesModule messages={messages} team={team} onRefresh={refreshModuleData} />;
  } else if (page === "settings") {
    Content = <SettingsModule user={user} />;
  } else {
    Content = <div className="content"><div className="loading-card">Módulo em desenvolvimento.</div></div>;
  }

  function logout() {
    localStorage.removeItem("webdev_token");
    setUser(null);
    setDashboard(null);
    setProjects([]);
    setTasks([]);
    setClients([]);
    setLeads([]);
    setSales([]);
    setFinance(null);
    setProduction(null);
    setMessages([]);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/logo.png" alt="Web Dev" />
          <button className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={19} /></button>
        </div>
        <div className="workspace"><span className="workspace-dot" /> Web Dev • Interno</div>
        <nav>
          {allowedNav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={currentNav.id === item.id ? "active" : ""} onClick={() => { setPage(item.id); setSidebarOpen(false); }}>
                <Icon size={18} />
                <span>{item.label}</span>
                {item.id === "messages" && <b>3</b>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="mini-avatar">{user.name.charAt(0)}</div>
            <div><strong>{user.name}</strong><span>{user.role === "ADMIN" ? "Admin" : user.area}</span></div>
          </div>
          <button className="logout" onClick={logout}><LogOut size={17} /> Sair</button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumb"><span>Web Dev</span><ChevronRight size={14} /><strong>{currentNav.label}</strong></div>
          <div className="top-actions">
            <div className="search-box"><Search size={16} /><input placeholder="Pesquisar..." /></div>
            <button className="icon-btn"><Bell size={18} /><i /></button>
            <div className="top-avatar">{user.name.charAt(0)}</div>
          </div>
        </header>

        {error && <div className="global-error">{error}</div>}
        {Content}
      </main>
    </div>
  );
}

export default App;
