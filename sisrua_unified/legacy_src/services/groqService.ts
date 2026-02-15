export class GroqService {
  static async analyzeData(stats: any, context: string = "") {
    const groqApiKey = localStorage.getItem('groq_api_key')?.replace(/"/g, '') || "";
    const API_URL = "https://api.groq.com/openai/v1/chat/completions";

    if (!groqApiKey) {
      throw new Error("Missing Groq API Key! Please add it in Settings > API Keys.");
    }

    try {
      const prompt = `
        You are an Expert Civil & Infrastructure Engineer. 
        Analyze the following spatial data extract:
        - Buildings: ${stats.buildings} (Total Area: ${stats.totalArea.toFixed(2)}m²)
        - Roads: ${stats.roads} (Total Length: ${stats.totalLength.toFixed(2)}m)
        - Infrastructure: ${stats.poles} poles/towers mapped.
        
        Additional Context: ${context}
        
        Provide a brief engineering audit (3-4 bullet points) covering:
        1. Urban density assessment.
        2. Potential infrastructure anomalies.
        3. A rough cost estimation for maintenance of this area.
        4. Technical recommendations based on specific violations if current.

        Current Violations Found:
        ${stats.violations_list.length > 0
          ? stats.violations_list.map((v: any) => `- [${v.type}] at ${v.lat}, ${v.lon}: ${v.description}`).join('\n')
          : "None found."
        }
        
        Keep it professional, technical, and concise.
      `;

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You are a professional infrastructure auditor." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 512
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      return data.choices[0].message.content;
    } catch (error: any) {
      console.error("Groq AI Error:", error);
      throw new Error(error.message || "Failed to connect to AI Auditor.");
    }
  }
}
