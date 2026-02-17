import Groq from 'groq-sdk';

export class GroqService {
    private static getClient(): Groq {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('GROQ_API_KEY not set');
        }

        return new Groq({ apiKey });
    }

    static async completePrompt(prompt: string, model = 'llama3-8b-8192'): Promise<string> {
        const groq = this.getClient();

        const completion = await groq.chat.completions.create({
            model,
            temperature: 0.2,
            messages: [{ role: 'user', content: prompt }]
        });

        return completion.choices[0]?.message?.content || '';
    }

    static async analyzeUrbanStats(stats: any, locationName: string): Promise<{ analysis: string }> {
        const hasData = stats?.buildings > 0 || stats?.roads > 0 || stats?.trees > 0 || stats?.totalBuildings > 0 || stats?.totalRoads > 0;

        const prompt = hasData
            ? `Analise urbana profissional em Português BR para ${locationName}: ${JSON.stringify(stats)}. Sugira melhorias focadas em mobilidade, infraestrutura e áreas verdes. Responda em markdown objetivo.`
            : `Explique em Português BR a falta de dados estruturais em ${locationName} e como o OSM pode ser complementado. Responda em markdown objetivo.`;

        const analysis = await this.completePrompt(prompt, 'mixtral-8x7b-32768');
        return { analysis };
    }
}
