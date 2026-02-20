import axios from "axios";

// Serviço para integração com IA (groqService)
// Envia metadados de elevação e recebe sugestões de traçado
export async function suggestDesign(elevationMetadata: any, prompt: string) {
  // endpoint e chave devem ser configurados via variável de ambiente
  const apiUrl = process.env.GROQ_API_URL;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiUrl || !apiKey) throw new Error("Configuração da IA não encontrada");
  const response = await axios.post(
    apiUrl,
    {
      prompt,
      metadata: elevationMetadata,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}
