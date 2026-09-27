import apiService from './api';

/**
 * AI chat service mirror of web FE.
 * Keeps a session history in memory and posts to /ai/chat.
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
}

export const aiService = {
  history: [] as ChatMessage[],

  async sendMessage(message: string, context: string = 'mobile') {
    const res = await apiService.post('/ai/chat', {
      message,
      history: this.history,
      context: { source: context },
    });
    const reply = res?.reply || res?.data?.reply || res?.message || '';
    if (reply) {
      this.history = [...this.history, { role: 'assistant', content: reply }];
    }
    return reply;
  },

  push(message: string) {
    this.history = [...this.history, { role: 'user', content: message }];
  },

  reset() {
    this.history = [];
  },

  async getHistory() {
    return apiService.get('/ai/history');
  },

  async search(query: string, limit = 5) {
    return apiService.get('/ai/search', { q: query, limit });
  },

  async learningPath(payload: { goals: string; background?: string; interests?: string[] }) {
    return apiService.post('/ai/learning-path', payload);
  },

  async careerQuiz(answers: any) {
    return apiService.post('/ai/career-quiz', { answers });
  },

  async trends(subject?: string) {
    return apiService.get('/ai/trends', subject ? { subject } : undefined);
  },
};

export default aiService;
