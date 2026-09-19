import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Code2,
  CreditCard,
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
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="seu@email.com"
              required
            />
          </label>
          <label>
            Senha
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              required
            />
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
                  <div className="bar revenue" style={{ height: `${Math.max(8, item.revenue / max * 100)}%` }} title={money(item.revenue)} />
                  <div className="bar expense" style={{ height: `${Math.max(8, item.expenses / max * 100)}%` }} title={money(item.expenses)} />
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

function ModulePage({ id }: { id: string }) {
  const config: Record<string, { title: string; desc: string; icon: typeof Activity; items: string[] }> = {
    projects: { title: "Projetos", desc: "Acompanhe entregas, prazos e status dos projetos.", icon: BriefcaseBusiness, items: ["Site institucional", "Landing page comercial", "Sistema interno"] },
    tasks: { title: "Tarefas", desc: "Organize o trabalho da equipe por prioridade.", icon: ClipboardList, items: ["Revisar layout", "Configurar banco Neon", "Publicar no Render"] },
    clients: { title: "Clientes", desc: "Centralize contatos e relacionamento comercial.", icon: Users, items: ["Empresa Alpha", "Cliente Beta", "Empresa Gamma"] },
    marketing: { title: "Marketing", desc: "Planeje campanhas, conteúdos e geração de leads.", icon: Megaphone, items: ["Campanha institucional", "Conteúdo para redes", "Captação de leads"] },
    sales: { title: "Vendas", desc: "Controle oportunidades e propostas comerciais.", icon: ShoppingBag, items: ["Proposta enviada", "Lead em negociação", "Contrato mensal"] },
    finance: { title: "Finanças", desc: "Visualize receitas, despesas e fluxo financeiro.", icon: WalletCards, items: ["Receitas", "Despesas", "Fluxo de caixa"] },
    production: { title: "Produção", desc: "Área técnica para desenvolvimento e operações.", icon: Code2, items: ["Deploy", "Banco de dados", "Infraestrutura"] },
    messages: { title: "Mensagens", desc: "Central de comunicação da equipe.", icon: MessageSquare, items: ["Equipe de desenvolvimento", "Comercial", "Avisos internos"] },
    settings: { title: "Configurações", desc: "Preferências e configurações do painel.", icon: Settings, items: ["Perfil", "Segurança", "Preferências"] }
  };
  const current = config[id] || config.projects;
  const Icon = current.icon;

  return (
    <div className="content">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">MÓDULO</span>
          <h1>{current.title}</h1>
          <p>{current.desc}</p>
        </div>
        <button className="primary-btn compact"><Plus size={17} /> Novo</button>
      </div>
      <div className="module-hero">
        <div className="module-icon"><Icon size={28} /></div>
        <div>
          <h2>Central de {current.title}</h2>
          <p>Estrutura pronta para conectar às rotinas da Web Dev.</p>
        </div>
      </div>
      <div className="cards-list">
        {current.items.map((item, i) => (
          <div className="list-card" key={item}>
            <div className="list-number">{String(i + 1).padStart(2, "0")}</div>
            <div><strong>{item}</strong><span>Atualizado recentemente</span></div>
            <ChevronRight size={18} />
          </div>
        ))}
      </div>
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

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [team, setTeam] = useState<TeamUser[]>([]);
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
  }, [user]);

  const allowedNav = useMemo(() => nav.filter((item) => {
    if (item.area !== "commercial") return true;
    return user?.role === "ADMIN" || user?.role === "MARKETING_VENDAS_FINANCAS";
  }), [user]);

  if (loading) return <div className="loading-screen"><div className="spinner" /> Carregando Web Dev...</div>;
  if (!user) return <Login onLogin={setUser} />;

  const currentNav = allowedNav.find((item) => item.id === page) || allowedNav[0];
  const Content = page === "dashboard"
    ? (dashboard ? <Dashboard data={dashboard} user={user} /> : <div className="content"><div className="loading-card"><div className="spinner" /> Carregando dados...</div></div>)
    : page === "team"
      ? <Team team={team} />
      : <ModulePage id={page} />;

  function logout() {
    localStorage.removeItem("webdev_token");
    setUser(null);
    setDashboard(null);
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
              <button
                key={item.id}
                className={currentNav.id === item.id ? "active" : ""}
                onClick={() => { setPage(item.id); setSidebarOpen(false); }}
              >
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
