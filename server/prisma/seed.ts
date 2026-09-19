import "dotenv/config";
import { PrismaClient, Role, Priority, ProjectStatus, TaskStatus, LeadStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const users = [
  { name: "Pedro", email: "pedro@webdev.local", role: Role.ADMIN, area: "Desenvolvimento + Operações", env: "PEDRO_PASSWORD" },
  { name: "Daniel", email: "daniel@webdev.local", role: Role.DEV_OPS, area: "Desenvolvimento + Operações", env: "DANIEL_PASSWORD" },
  { name: "Pablo", email: "pablo@webdev.local", role: Role.DEV_OPS, area: "Desenvolvimento + Operações", env: "PABLO_PASSWORD" },
  { name: "Samuel", email: "samuel@webdev.local", role: Role.MARKETING_VENDAS_FINANCAS, area: "Marketing + Vendas + Finanças", env: "SAMUEL_PASSWORD" },
  { name: "Guilherme", email: "guilherme@webdev.local", role: Role.MARKETING_VENDAS_FINANCAS, area: "Marketing + Vendas + Finanças", env: "GUILHERME_PASSWORD" }
];

async function main() {
  const created: Record<string, { id: string }> = {};

  for (const user of users) {
    const password = process.env[user.env] || "WebDev@2026";
    const passwordHash = await bcrypt.hash(password, 12);

    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        area: user.area,
        passwordHash
      },
      create: {
        name: user.name,
        email: user.email,
        role: user.role,
        area: user.area,
        passwordHash
      }
    });

    created[user.name] = saved;
  }

  const projectCount = await prisma.project.count();
  if (projectCount === 0) {
    const project = await prisma.project.create({
      data: {
        name: "Site institucional Web Dev",
        description: "Projeto inicial da operação",
        status: ProjectStatus.EM_ANDAMENTO,
        priority: Priority.ALTA,
        ownerId: created.Pedro.id
      }
    });

    await prisma.task.createMany({
      data: [
        { title: "Configurar banco Neon", status: TaskStatus.CONCLUIDA, priority: Priority.ALTA, projectId: project.id, assigneeId: created.Pedro.id },
        { title: "Preparar deploy no Render", status: TaskStatus.EM_ANDAMENTO, priority: Priority.ALTA, projectId: project.id, assigneeId: created.Daniel.id },
        { title: "Revisar identidade visual", status: TaskStatus.A_FAZER, priority: Priority.MEDIA, projectId: project.id, assigneeId: created.Pablo.id }
      ]
    });
  }

  if (await prisma.client.count() === 0) {
    const client = await prisma.client.create({
      data: {
        name: "Empresa Alpha",
        company: "Empresa Alpha",
        email: "contato@alpha.local"
      }
    });

    await prisma.lead.create({
      data: {
        name: "Lead Alpha",
        company: "Empresa Alpha",
        email: "contato@alpha.local",
        status: LeadStatus.NEGOCIACAO,
        value: 1800,
        clientId: client.id
      }
    });

    await prisma.sale.create({
      data: {
        title: "Site institucional",
        value: 1800,
        clientId: client.id
      }
    });
  }

  if (await prisma.revenue.count() === 0) {
    await prisma.revenue.createMany({
      data: [
        { description: "Projeto inicial", value: 1800, date: new Date() },
        { description: "Mensalidade", value: 650, date: new Date(Date.now() - 25 * 86400000) },
        { description: "Projeto landing page", value: 900, date: new Date(Date.now() - 50 * 86400000) }
      ]
    });
  }

  if (await prisma.expense.count() === 0) {
    await prisma.expense.createMany({
      data: [
        { description: "Infraestrutura", value: 180, date: new Date() },
        { description: "Ferramentas", value: 120, date: new Date(Date.now() - 25 * 86400000) }
      ]
    });
  }

  console.log("Seed concluído.");
  console.log("Usuários:");
  for (const user of users) {
    console.log(`- ${user.email} / ${process.env[user.env] || "WebDev@2026"}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
