class SearchService {
  private readonly AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000/api/ai';

  async semanticSearch(query: string, limit: number = 5): Promise<any[]> {
    if (!query.trim()) return [];

    try {
      const response = await fetch(`${this.AI_API_URL}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Semantic Search Error:', error);
      return [];
    }
  }
}

export const searchService = new SearchService();
