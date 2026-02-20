// Entidade de Projeto (Project) - Domain Layer
export interface Project {
  id: string;
  userId: string;
  name: string;
  coords: Array<{ lat: number; lng: number }>;
  createdAt: Date;
  updatedAt: Date;
  snapshots?: string[];
}
