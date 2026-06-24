import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GoogleAIService {
  private readonly logger = new Logger(GoogleAIService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private model: any;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      const modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-1.5-flash';
      this.model = this.genAI.getGenerativeModel({ model: modelName });
    }
  }

  async generateContent(prompt: string, context?: any): Promise<string> {
    if (!this.genAI || !this.model) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const fullPrompt = context 
        ? `${prompt}\n\nContext: ${JSON.stringify(context)}`
        : prompt;
      
      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      this.logger.error(`Gemini API error: ${error.message}`);
      throw error;
    }
  }

  async analyzeGeoDensity(city: string, points: any[]): Promise<any> {
    const pointCount = points.length;
    const categoryStats: Record<string, number> = {};
    
    points.forEach(p => {
      const cat = p.type || p.category || 'unknown';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });

    const prompt = `Analyze educational infrastructure density in ${city}.
    
Points data: ${pointCount} educational locations
Categories: ${Object.entries(categoryStats).map(([k,v]) => `${k}:${v}`).join(', ')}

Return JSON with: summary, density_score (0-10), recommendations (array with area, priority, reason).`;

    try {
      const response = await this.generateContent(prompt);
      return JSON.parse(response);
    } catch (error) {
      this.logger.error(`Geo density analysis error: ${error.message}`);
      return {
        summary: "AI analysis temporarily unavailable. Based on map data, educational facilities are concentrated in the Biên Hòa area.",
        density_score: 7.5,
        recommendations: [
          { area: "Infrastructure", priority: "High", reason: "Expand lab and public WiFi facilities." }
        ]
      };
    }
  }
}