import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient, Role, TaskStatus, LeadStatus, ProjectStatus, Priority } from "@prisma/client";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const app = express();

const PORT = Number(process.env.PORT ?? 3000);
const JWT_SECRET = process.env.JWT_SECRET ?? "development-only-secret-change-me";
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;

const allowedOrigins = [
  CLIENT_URL,
  RENDER_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174"
].filter((origin): origin is string => Boolean(origin));

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true;

  if (allowedOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);
    const isLocalVitePort = ["localhost", "127.0.0.1", "::1"].includes(url.hostname) && /^517\d+$/.test(url.port || "");
    return isLocalVitePort;
  } catch {
    return false;
  }
}

app.use(cors({ origin: (origin, callback) => {
  if (isAllowedOrigin(origin)) return callback(null, true);
  return callback(new Error("Origin não permitida"));
}, credentials: true }));
app.use(express.json({ limit: "1mb" }));

type AuthUser = { id: string; role: Role };
type AuthRequest = Request & { user?: AuthUser };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  area: true,
  createdAt: true,
  updatedAt: true
} as const;

function createToken(user: AuthUser) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
}

function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  try {
    req.user = jwt.verify(authorization.slice(7), JWT_SECRET) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ message: "Sessão expirada" });
  }
}

function authorize(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Não autenticado" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Você não possui permissão para esta área" });
    }
    next();
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "web-dev-api" });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: "Email e senha são obrigatórios" });

    const email = result.data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(result.data.password, user.passwordHash))) {
      return res.status(401).json({ message: "Email ou senha inválidos" });
    }

    await prisma.activityLog.create({
      data: { userId: user.id, action: "entrou no sistema" }
    });

    return res.json({
      token: createToken({ id: user.id, role: user.role }),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        area: user.area
      }
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ message: "Erro ao realizar login" });
  }
});

app.get("/api/auth/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: userSelect
    });

    if (!user) return res.status(401).json({ message: "Usuário não encontrado" });
    return res.json(user);
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    return res.status(500).json({ message: "Erro ao buscar usuário" });
  }
});

app.put("/api/auth/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      area: z.string().min(2).optional()
    });

    const payload = schema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: payload,
      select: userSelect
    });

    await prisma.activityLog.create({
      data: { userId: req.user!.id, action: "atualizou o perfil" }
    });

    return res.json(user);
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return res.status(400).json({ message: "Dados inválidos para atualização do perfil" });
  }
});

app.get("/api/dashboard", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      activeProjects,
      completedProjects,
      pendingTasks,
      overdueTasks,
      activeLeads,
      sales,
      revenue,
      expenses,
      activities
    ] = await Promise.all([
      prisma.project.count({ where: { status: { not: ProjectStatus.CONCLUIDO } } }),
      prisma.project.count({ where: { status: ProjectStatus.CONCLUIDO } }),
      prisma.task.count({ where: { status: { not: TaskStatus.CONCLUIDA } } }),
      prisma.task.count({
        where: {
          status: { not: TaskStatus.CONCLUIDA },
          dueDate: { lt: new Date() }
        }
      }),
      prisma.lead.count({ where: { status: { not: LeadStatus.PERDIDO } } }),
      prisma.sale.count(),
      prisma.revenue.aggregate({ _sum: { value: true } }),
      prisma.expense.aggregate({ _sum: { value: true } }),
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } }
      })
    ]);

    const now = new Date();
    const monthly: { month: string; revenue: number; expenses: number }[] = [];

    for (let i = 5; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const [r, e] = await Promise.all([
        prisma.revenue.aggregate({
          _sum: { value: true },
          where: { date: { gte: start, lt: end } }
        }),
        prisma.expense.aggregate({
          _sum: { value: true },
          where: { date: { gte: start, lt: end } }
        })
      ]);

      monthly.push({
        month: start.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        revenue: Number(r._sum.value ?? 0),
        expenses: Number(e._sum.value ?? 0)
      });
    }

    return res.json({
      stats: {
        projects: activeProjects,
        completedProjects,
        pendingTasks,
        overdueTasks,
        leads: activeLeads,
        sales,
        revenue: Number(revenue._sum.value ?? 0),
        expenses: Number(expenses._sum.value ?? 0)
      },
      monthly,
      activities: activities.map((activity) => ({
        id: activity.id,
        user: activity.user?.name ?? "Sistema",
        action: activity.action,
        createdAt: activity.createdAt
      }))
    });
  } catch (error) {
    console.error("Erro no dashboard:", error);
    return res.status(500).json({ message: "Erro ao carregar dashboard" });
  }
});

app.get("/api/team", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: { name: "asc" }
    });
    return res.json(users);
  } catch (error) {
    console.error("Erro na equipe:", error);
    return res.status(500).json({ message: "Erro ao carregar equipe" });
  }
});

app.get("/api/projects", authenticate, async (_req, res) => {
  const projects = await prisma.project.findMany({
    include: { owner: { select: { name: true } }, tasks: true },
    orderBy: { updatedAt: "desc" }
  });
  res.json(projects);
});

app.post("/api/projects", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2),
    description: z.string().optional().or(z.literal("")),
    status: z.nativeEnum(ProjectStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    dueDate: z.string().optional().or(z.literal(""))
  });

  const data = schema.parse(req.body);
  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description || null,
      status: data.status ?? ProjectStatus.PLANEJADO,
      priority: data.priority ?? Priority.MEDIA,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      ownerId: req.user!.id
    }
  });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `criou o projeto ${project.name}` }
  });

  res.status(201).json(project);
});

app.put("/api/projects/:id", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional().or(z.literal("")),
    status: z.nativeEnum(ProjectStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    dueDate: z.string().optional().or(z.literal(""))
  });

  const id = String(req.params.id);
  const data = schema.parse(req.body);
  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      description: data.description !== undefined ? (data.description || null) : undefined,
      ...(data.status ? { status: data.status } : {}),
      ...(data.priority ? { priority: data.priority } : {}),
      dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined
    }
  });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `atualizou o projeto ${project.name}` }
  });

  res.json(project);
});

app.delete("/api/projects/:id", authenticate, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const project = await prisma.project.delete({ where: { id } });
  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `removeu o projeto ${project.name}` }
  });
  res.status(204).send();
});

app.get("/api/tasks", authenticate, async (_req, res) => {
  const tasks = await prisma.task.findMany({
    include: {
      assignee: { select: { name: true } },
      project: { select: { name: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json(tasks);
});

app.post("/api/tasks", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    title: z.string().min(2),
    description: z.string().optional().or(z.literal("")),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    dueDate: z.string().optional().or(z.literal("")),
    projectId: z.string().optional().or(z.literal("")),
    assigneeId: z.string().optional().or(z.literal(""))
  });

  const data = schema.parse(req.body);
  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description || null,
      status: data.status ?? TaskStatus.A_FAZER,
      priority: data.priority ?? Priority.MEDIA,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      projectId: data.projectId || null,
      assigneeId: data.assigneeId || null
    }
  });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `criou a tarefa ${task.title}` }
  });

  res.status(201).json(task);
});

app.put("/api/tasks/:id", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional().or(z.literal("")),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    dueDate: z.string().optional().or(z.literal("")),
    projectId: z.string().optional().or(z.literal("")),
    assigneeId: z.string().optional().or(z.literal(""))
  });

  const id = String(req.params.id);
  const data = schema.parse(req.body);
  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(data.title ? { title: data.title } : {}),
      description: data.description !== undefined ? (data.description || null) : undefined,
      ...(data.status ? { status: data.status } : {}),
      ...(data.priority ? { priority: data.priority } : {}),
      dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
      projectId: data.projectId !== undefined ? (data.projectId || null) : undefined,
      assigneeId: data.assigneeId !== undefined ? (data.assigneeId || null) : undefined
    }
  });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `atualizou a tarefa ${task.title}` }
  });

  res.json(task);
});

app.patch("/api/tasks/:id/status", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({ status: z.nativeEnum(TaskStatus) });
  const id = String(req.params.id);
  const { status } = schema.parse(req.body);

  const task = await prisma.task.update({
    where: { id },
    data: { status }
  });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `alterou a tarefa ${task.title} para ${status}` }
  });

  res.json(task);
});

app.delete("/api/tasks/:id", authenticate, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const task = await prisma.task.delete({ where: { id } });
  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `removeu a tarefa ${task.title}` }
  });
  res.status(204).send();
});

app.get("/api/clients", authenticate, async (_req, res) => {
  res.json(await prisma.client.findMany({ orderBy: { createdAt: "desc" } }));
});

app.post("/api/clients", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    company: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal(""))
  });

  const data = schema.parse(req.body);
  const client = await prisma.client.create({
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      notes: data.notes || null
    }
  });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `cadastrou o cliente ${client.name}` }
  });

  res.status(201).json(client);
});

app.put("/api/clients/:id", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    company: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal(""))
  });

  const id = String(req.params.id);
  const data = schema.parse(req.body);
  const client = await prisma.client.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      email: data.email !== undefined ? (data.email || null) : undefined,
      phone: data.phone !== undefined ? (data.phone || null) : undefined,
      company: data.company !== undefined ? (data.company || null) : undefined,
      notes: data.notes !== undefined ? (data.notes || null) : undefined
    }
  });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `atualizou o cliente ${client.name}` }
  });

  res.json(client);
});

app.delete("/api/clients/:id", authenticate, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const client = await prisma.client.delete({ where: { id } });
  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `removeu o cliente ${client.name}` }
  });
  res.status(204).send();
});

app.get("/api/leads", authenticate, async (_req, res) => {
  res.json(await prisma.lead.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } }));
});

app.post("/api/leads", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email().optional().or(z.literal("")),
    company: z.string().optional().or(z.literal("")),
    status: z.nativeEnum(LeadStatus).optional(),
    value: z.coerce.number().nonnegative().optional(),
    clientId: z.string().optional().or(z.literal(""))
  });

  const data = schema.parse(req.body);
  const lead = await prisma.lead.create({
    data: {
      name: data.name,
      email: data.email || null,
      company: data.company || null,
      status: data.status ?? LeadStatus.NOVO,
      value: data.value ? Number(data.value) : 0,
      clientId: data.clientId || null
    },
    include: { client: true }
  });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `registrou o lead ${lead.name}` }
  });

  res.status(201).json(lead);
});

app.put("/api/leads/:id", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional().or(z.literal("")),
    company: z.string().optional().or(z.literal("")),
    status: z.nativeEnum(LeadStatus).optional(),
    value: z.coerce.number().nonnegative().optional(),
    clientId: z.string().optional().or(z.literal(""))
  });

  const id = String(req.params.id);
  const data = schema.parse(req.body);
  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      email: data.email !== undefined ? (data.email || null) : undefined,
      company: data.company !== undefined ? (data.company || null) : undefined,
      ...(data.status ? { status: data.status } : {}),
      value: data.value !== undefined ? Number(data.value) : undefined,
      clientId: data.clientId !== undefined ? (data.clientId || null) : undefined
    },
    include: { client: true }
  });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `atualizou o lead ${lead.name}` }
  });

  res.json(lead);
});

app.delete("/api/leads/:id", authenticate, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const lead = await prisma.lead.delete({ where: { id } });
  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `removeu o lead ${lead.name}` }
  });
  res.status(204).send();
});

app.get("/api/sales", authenticate, async (_req, res) => {
  res.json(await prisma.sale.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } }));
});

app.post("/api/sales", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    title: z.string().min(2),
    value: z.coerce.number().nonnegative(),
    clientId: z.string().optional().or(z.literal(""))
  });

  const data = schema.parse(req.body);
  const sale = await prisma.sale.create({
    data: {
      title: data.title,
      value: Number(data.value),
      clientId: data.clientId || null
    },
    include: { client: true }
  });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `registrou a venda ${sale.title}` }
  });

  res.status(201).json(sale);
});

app.put("/api/sales/:id", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    title: z.string().min(2).optional(),
    value: z.coerce.number().nonnegative().optional(),
    clientId: z.string().optional().or(z.literal(""))
  });

  const id = String(req.params.id);
  const data = schema.parse(req.body);
  const sale = await prisma.sale.update({
    where: { id },
    data: {
      ...(data.title ? { title: data.title } : {}),
      value: data.value !== undefined ? Number(data.value) : undefined,
      clientId: data.clientId !== undefined ? (data.clientId || null) : undefined
    },
    include: { client: true }
  });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `atualizou a venda ${sale.title}` }
  });

  res.json(sale);
});

app.delete("/api/sales/:id", authenticate, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const sale = await prisma.sale.delete({ where: { id } });
  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `removeu a venda ${sale.title}` }
  });
  res.status(204).send();
});

app.get("/api/finance", authenticate, async (_req, res) => {
  const [revenue, expense] = await Promise.all([
    prisma.revenue.findMany({ orderBy: { date: "desc" } }),
    prisma.expense.findMany({ orderBy: { date: "desc" } })
  ]);

  const revenueTotal = revenue.reduce((sum, item) => sum + Number(item.value), 0);
  const expenseTotal = expense.reduce((sum, item) => sum + Number(item.value), 0);

  res.json({
    revenue,
    expense,
    totals: {
      revenue: revenueTotal,
      expense: expenseTotal,
      balance: revenueTotal - expenseTotal
    }
  });
});

app.post("/api/finance", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    type: z.enum(["revenue", "expense"]),
    description: z.string().min(2),
    value: z.coerce.number().positive(),
    date: z.string().optional().or(z.literal(""))
  });

  const data = schema.parse(req.body);

  const entry = data.type === "revenue"
    ? await prisma.revenue.create({ data: { description: data.description, value: Number(data.value), date: data.date ? new Date(data.date) : new Date() } })
    : await prisma.expense.create({ data: { description: data.description, value: Number(data.value), date: data.date ? new Date(data.date) : new Date() } });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `registrou ${data.type === "revenue" ? "uma entrada" : "uma saída"} de ${data.description}` }
  });

  res.status(201).json(entry);
});

app.put("/api/finance/:type/:id", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    description: z.string().min(2).optional(),
    value: z.coerce.number().positive().optional(),
    date: z.string().optional().or(z.literal(""))
  });

  const id = String(req.params.id);
  const data = schema.parse(req.body);

  if (req.params.type === "revenue") {
    const entry = await prisma.revenue.update({
      where: { id },
      data: {
        ...(data.description ? { description: data.description } : {}),
        ...(data.value ? { value: Number(data.value) } : {}),
        ...(data.date !== undefined ? { date: data.date ? new Date(data.date) : new Date() } : {})
      }
    });

    await prisma.activityLog.create({
      data: { userId: req.user!.id, action: `atualizou um registro financeiro` }
    });

    return res.json(entry);
  }

  const entry = await prisma.expense.update({
    where: { id },
    data: {
      ...(data.description ? { description: data.description } : {}),
      ...(data.value ? { value: Number(data.value) } : {}),
      ...(data.date !== undefined ? { date: data.date ? new Date(data.date) : new Date() } : {})
    }
  });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `atualizou um registro financeiro` }
  });

  return res.json(entry);
});

app.delete("/api/finance/:type/:id", authenticate, async (req: AuthRequest, res) => {
  const id = String(req.params.id);

  if (req.params.type === "revenue") {
    const item = await prisma.revenue.delete({ where: { id } });
    await prisma.activityLog.create({
      data: { userId: req.user!.id, action: `removeu um registro financeiro` }
    });
    return res.status(204).send();
  }

  const item = await prisma.expense.delete({ where: { id } });
  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `removeu um registro financeiro` }
  });
  res.status(204).send();
});

app.get("/api/production", authenticate, async (_req, res) => {
  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      where: { status: { not: ProjectStatus.CONCLUIDO } },
      orderBy: { updatedAt: "desc" },
      include: { owner: { select: { name: true } } }
    }),
    prisma.task.findMany({
      where: { status: { not: TaskStatus.CONCLUIDA } },
      orderBy: { dueDate: "asc" },
      include: { assignee: { select: { name: true } }, project: { select: { name: true } } }
    })
  ]);

  res.json({ projects, tasks });
});

app.get("/api/messages", authenticate, async (req: AuthRequest, res) => {
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: req.user!.id },
        { recipientId: req.user!.id },
        { recipientId: null }
      ]
    },
    include: {
      sender: { select: { id: true, name: true, email: true } },
      recipient: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  res.json(messages.map((message) => ({
    id: message.id,
    subject: message.subject ?? "Sem assunto",
    content: message.content,
    sender: message.sender,
    recipient: message.recipient,
    read: message.read,
    createdAt: message.createdAt
  })));
});

app.post("/api/messages", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    recipientId: z.string().optional().or(z.literal("")),
    subject: z.string().min(1),
    content: z.string().min(1)
  });

  const data = schema.parse(req.body);
  const message = await prisma.message.create({
    data: {
      senderId: req.user!.id,
      recipientId: data.recipientId || null,
      subject: data.subject,
      content: data.content,
      read: false
    },
    include: {
      sender: { select: { id: true, name: true, email: true } },
      recipient: { select: { id: true, name: true, email: true } }
    }
  });

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `enviou a mensagem ${message.subject}` }
  });

  res.status(201).json(message);
});

app.patch("/api/messages/:id/read", authenticate, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const message = await prisma.message.update({
    where: { id },
    data: { read: true },
    include: {
      sender: { select: { id: true, name: true, email: true } },
      recipient: { select: { id: true, name: true, email: true } }
    }
  });

  res.json(message);
});

app.get("/api/notifications", authenticate, async (_req, res) => {
  const notifications = await prisma.activityLog.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } }
  });

  res.json(notifications.map((item) => ({
    id: item.id,
    message: item.action,
    user: item.user?.name ?? "Sistema",
    createdAt: item.createdAt
  })));
});

app.get("/api/reports", authenticate, authorize(Role.ADMIN, Role.MARKETING_VENDAS_FINANCAS), async (_req, res) => {
  const [projects, sales, leads, revenue, expense] = await Promise.all([
    prisma.project.count(),
    prisma.sale.count(),
    prisma.lead.count(),
    prisma.revenue.aggregate({ _sum: { value: true } }),
    prisma.expense.aggregate({ _sum: { value: true } })
  ]);

  res.json({
    projects,
    sales,
    leads,
    revenue: Number(revenue._sum.value ?? 0),
    expense: Number(expense._sum.value ?? 0)
  });
});

app.get("/api/healthcheck", authenticate, async (_req, res) => {
  res.json({ status: "ok" });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../../../client/dist");

if (process.env.NODE_ENV === "production") {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((_req, res) => {
  res.status(404).json({ message: "Rota não encontrada" });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Erro não tratado:", error);
  if (!res.headersSent) res.status(500).json({ message: "Erro interno do servidor" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web Dev API rodando na porta ${PORT}`);
});

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
