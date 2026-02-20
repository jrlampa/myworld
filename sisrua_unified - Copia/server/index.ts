import { saveProject, getUserProjects, updateProject, deleteProject } from "../services/cloudStorage";
import { getUserQuota, incrementUserQuota } from "../services/quota";
import { suggestDesign } from "../services/aiSuggest";
import { enqueueAsyncTask } from "./services/asyncTaskService";
import projectRoutes from "./interfaces/projectRoutes";

export const Project = {
  name: "Project",
  fields: {
    name: { type: "string", required: true },
    coords: { type: "array", required: true },
  },
};

export const ProjectSchema = {
  name: "Project",
  fields: {
    name: { type: "string", required: true },
    coords: { type: "array", required: true },
  },
};

export const ProjectController = {
  async saveProject(userId, projectData) {
    return await saveProject(userId, projectData);
  },
  async getUserProjects(userId) {
    return await getUserProjects(userId);
  },
  async updateProject(projectId, projectData) {
    return await updateProject(projectId, projectData);
  },
  async deleteProject(projectId) {
    return await deleteProject(projectId);
  },
};

// Exemplo de uso (substitua pelo fluxo real do app):
// await saveProject(userId, { name: "Projeto Teste", coords: [...] });
// const projects = await getUserProjects(userId);
// await updateProject(projectId, { name: "Novo Nome" });
// await deleteProject(projectId);
// const quota = await getUserQuota(userId);
// await incrementUserQuota(userId);

// Exemplo de uso:
// const result = await suggestDesign(elevationMetadata, "Sugira o melhor traçado de drenagem para as curvas de nível abaixo...");
// await enqueueAsyncTask({ dxfId: "123", ... }, webhookUrl);

// app.use(express.json()); // já deve estar presente
app.use("/api", projectRoutes);