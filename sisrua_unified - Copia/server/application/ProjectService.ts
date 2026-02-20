// Serviço de Aplicação para Projetos - Application Layer
import { Project } from "../domain/Project";

export interface ProjectRepository {
  save(project: Project): Promise<Project>;
  findById(id: string): Promise<Project | null>;
  findByUser(userId: string): Promise<Project[]>;
  delete(id: string): Promise<void>;
}

export class ProjectService {
  constructor(private repo: ProjectRepository) {}

  async createProject(data: Omit<Project, "id" | "createdAt" | "updatedAt">): Promise<Project> {
    const now = new Date();
    const project: Project = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    return this.repo.save(project);
  }

  async getProject(id: string) {
    return this.repo.findById(id);
  }

  async getUserProjects(userId: string) {
    return this.repo.findByUser(userId);
  }

  async deleteProject(id: string) {
    return this.repo.delete(id);
  }
}
