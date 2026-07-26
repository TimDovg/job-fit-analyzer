import OpenAI from "openai";
import { z } from "zod";
import { config } from "../config.js";
import type { AnalysisResult, VacancyDetails } from "../types.js";
import { loadJobFitPrompt } from "./skillPrompt.js";

const resultSchema = z.object({
  score: z.number().min(0).max(10),
  analysisText: z.string().min(50)
});

export class Analyzer {
  private client: OpenAI;
  private systemPrompt: string;

  constructor() {
    if (!config.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
    this.systemPrompt = loadJobFitPrompt();
  }

  async analyze(vacancy: VacancyDetails): Promise<AnalysisResult> {
    const response = await this.client.responses.create({
      model: config.openaiModel,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                `${this.systemPrompt}\n\n` +
                "Return only valid JSON matching this shape: " +
                '{"score": number, "analysisText": string}. ' +
                "analysisText must be the complete Russian analysis in the skill's Default Analysis Format."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Source: ${vacancy.source}`,
                `URL: ${vacancy.url}`,
                `Title: ${vacancy.title}`,
                vacancy.company ? `Company: ${vacancy.company}` : "",
                vacancy.publishedAt ? `Published at: ${vacancy.publishedAt}` : "Published date unavailable",
                vacancy.location ? `Location: ${vacancy.location}` : "",
                vacancy.compensation ? `Compensation: ${vacancy.compensation}` : "",
                "",
                "Vacancy text:",
                vacancy.description
              ]
                .filter(Boolean)
                .join("\n")
            }
          ]
        }
      ]
    });

    const outputText = response.output_text.trim();
    const parsed = resultSchema.safeParse(parseJsonObject(outputText));
    if (!parsed.success) {
      throw new Error(`Unexpected analysis response: ${parsed.error.message}`);
    }

    return parsed.data;
  }
}

function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Analysis response did not contain JSON: ${text.slice(0, 300)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
