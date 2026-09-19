import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient, Role, TaskStatus } from "@prisma/client";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const app = express();

const PORT = Number(process.env.PORT ?? 3000);
const JWT_SECRET = process.env.JWT_SECRET ?? "development-only-secret-change-me";
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL === "*" ? true : CLIENT_URL }));
app.use(express.json({ limit: "1mb" }));

type AuthUser = { id: string; role: Role };
type AuthRequest = Request & { user?: AuthUser };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

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
      select: { id: true, name: true, email: true, role: true, area: true }
    });

    if (!user) return res.status(401).json({ message: "Usuário não encontrado" });
    return res.json(user);
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    return res.status(500).json({ message: "Erro ao buscar usuário" });
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
      prisma.project.count({ where: { status: { not: "CONCLUIDO" } } }),
      prisma.project.count({ where: { status: "CONCLUIDO" } }),
      prisma.task.count({ where: { status: { not: TaskStatus.CONCLUIDA } } }),
      prisma.task.count({
        where: {
          status: { not: TaskStatus.CONCLUIDA },
          dueDate: { lt: new Date() }
        }
      }),
      prisma.lead.count({ where: { status: { not: "PERDIDO" } } }),
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
      select: { id: true, name: true, email: true, role: true, area: true, createdAt: true },
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

app.get("/api/clients", authenticate, async (_req, res) => {
  res.json(await prisma.client.findMany({ orderBy: { createdAt: "desc" } }));
});

app.get("/api/leads", authenticate, async (_req, res) => {
  res.json(await prisma.lead.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } }));
});

app.get("/api/sales", authenticate, async (_req, res) => {
  res.json(await prisma.sale.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } }));
});

app.post("/api/projects", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(2),
    description: z.string().optional()
  });
  const data = schema.parse(req.body);
  const project = await prisma.project.create({
    data: { ...data, ownerId: req.user!.id }
  });
  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `criou o projeto ${project.name}` }
  });
  res.status(201).json(project);
});

app.post("/api/tasks", authenticate, async (req: AuthRequest, res) => {
  const schema = z.object({
    title: z.string().min(2),
    projectId: z.string().optional(),
    assigneeId: z.string().optional()
  });
  const data = schema.parse(req.body);
  const task = await prisma.task.create({ data });
  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: `criou a tarefa ${task.title}` }
  });
  res.status(201).json(task);
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

app.listen(PORT, () => {
  console.log(`Web Dev API rodando na porta ${PORT}`);
});

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
