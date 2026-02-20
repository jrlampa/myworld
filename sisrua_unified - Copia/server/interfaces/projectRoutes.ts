// Interface REST para Projetos - Interface Layer
import express from "express";
import { ProjectService } from "../application/ProjectService";
import { FirestoreProjectRepository } from "../infrastructure/FirestoreProjectRepository";

const router = express.Router();
const service = new ProjectService(new FirestoreProjectRepository());

router.post("/projects", async (req, res) => {
  try {
    const project = await service.createProject(req.body);
    res.status(201).json(project);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.get("/projects/:id", async (req, res) => {
  const project = await service.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: "Not found" });
  res.json(project);
});

router.get("/users/:userId/projects", async (req, res) => {
  const projects = await service.getUserProjects(req.params.userId);
  res.json(projects);
});

router.delete("/projects/:id", async (req, res) => {
  await service.deleteProject(req.params.id);
  res.status(204).end();
});

export default router;
