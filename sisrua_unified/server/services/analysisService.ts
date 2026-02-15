import Groq from 'groq-sdk';

export class AnalysisService {
    /**
     * Analyzes urban stats using AI
     */
    static async analyzeArea(stats: any, locationName: string, apiKey: string) {
        if (!apiKey) throw new Error('GROQ_API_KEY is missing');

        const groq = new Groq({ apiKey });
        const hasData = stats.buildings > 0 || stats.roads > 0 || stats.trees > 0;

        const prompt = hasData ?
            `Analise urbana profissional em Português BR para ${locationName}: ${JSON.stringify(stats)}. Sugira melhorias focadas em mobilidade, infraestrutura e áreas verdes. Formate como Markdown profissional. Responda APENAS JSON: { "analysis": "markdown" }` :
            `Explique em Português BR a falta de dados estruturais em ${locationName} e como o OSM pode ser complementado. JSON: { "analysis": "markdown" }`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.2
        });

        const text = completion.choices[0]?.message?.content || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        } else {
            return { analysis: "Erro ao processar análise AI. Formato inválido." };
        }
    }
}
