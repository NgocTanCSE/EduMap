import { Controller, Get, Post, Body, UseGuards, Request, Query, HttpCode, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('AI Assistant')
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) { }

  @Post('chat')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-05: Chatbot AI (LLM + RAG)' })
  async chat(
    @Request() req: any,
    @Body('message') msg: string,
    @Body('history') history: any[],
    @Body('context') ctx: any,
    @Body('session_id') sessionId?: string,
  ) {
    if (!msg || msg.trim().length === 0) {
      return { message: 'Tin nhắn không được để trống.' };
    }
    return this.aiService.chat(msg, history || [], ctx, req.user.id, sessionId);
  }

  @Post('chat-stream')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-05b: Chatbot AI streaming (SSE)' })
  async chatStream(
    @Request() req: any,
    @Body('message') msg: string,
    @Body('history') history: any[],
    @Body('context') ctx: any,
    @Res() res: any,
    @Body('session_id') sessionId?: string,
  ) {
    if (!msg || msg.trim().length === 0) {
      res.status(400).json({ message: 'Tin nhắn không được để trống.' });
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    await this.aiService.chatStream(msg, history || [], ctx, req.user.id, res, sessionId);
  }

  @Post('agent/chat-stream')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-05c: AI Map Agent streaming (NL → GIS, SSE)' })
  async agentChatStream(
    @Request() req: any,
    @Body('message') msg: string,
    @Body('history') history: any[],
    @Body('context') ctx: any,
    @Res() res: any,
    @Body('session_id') sessionId?: string,
  ) {
    if (!msg || msg.trim().length === 0) {
      res.status(400).json({ message: 'Tin nhắn không được để trống.' });
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    await this.aiService.agentChatStream(msg, history || [], ctx, req.user.id, res, sessionId);
  }

  @Post('agent/chat')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-05c: AI Map Agent (NL → GIS)' })
  async agentChat(
    @Request() req: any,
    @Body('message') msg: string,
    @Body('history') history: any[],
    @Body('context') ctx: any,
    @Body('session_id') sessionId?: string,
  ) {
    if (!msg || msg.trim().length === 0) {
      return { message: 'Tin nhắn không được để trống.' };
    }
    return this.aiService.agentChat(msg, history || [], ctx, req.user.id, sessionId);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy lịch sử cuộc trò chuyện' })
  async getHistory(@Request() req: any) {
    return this.aiService.getUserHistory(req.user.id);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm AI theo tài liệu và địa điểm' })
  async search(@Query('q') query: string, @Query('limit') limit?: string) {
    if (!query || !query.trim()) {
      return { success: true, data: [] };
    }
    return this.aiService.search(query, limit ? parseInt(limit, 10) : 5);
  }

  @Post('sync-knowledge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kích hoạt đồng bộ tri thức từ DB sang AI Vector Store' })
  async syncKnowledge() {
    this.aiService.triggerKnowledgeSync();
    return {
      success: true,
      message: 'Đã kích hoạt đồng bộ dữ liệu sang AI Vector Store thành công.',
    };
  }

  @Post('learning-path')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-06: Tạo lộ trình học cá nhân hóa bằng AI' })
  async getLearningPath(
    @Request() req: any,
    @Body('current_level') currentLevel: string,
    @Body('target_role') targetRole: string,
    @Body('time_commitment_hours_per_week') timeCommitment: number,
  ) {
    const data = {
      user_id: req.user.id,
      current_level: currentLevel || 'Beginner',
      target_role: targetRole || 'AI Developer',
      time_commitment_hours_per_week: timeCommitment || 10,
    };
    return this.aiService.generateLearningPath(data);
  }

  @Post('career-quiz')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-08: Nộp bài trắc nghiệm hướng nghiệp' })
  async submitQuiz(@Request() req: any, @Body('answers') answers: any) {
    return this.aiService.predictCareerPath({ user_id: req.user.id, answers, task: "career_quiz" });
  }

  @Public()
  @Get('trends')
  @ApiOperation({ summary: 'Phân tích xu hướng thị trường' })
  async getTrends() {
    return this.aiService.getMarketTrends();
  }

  @Public()
  @Get('analytics/stats')
  @ApiOperation({ summary: 'Thống kê AI Analytics' })
  async getAnalyticsStats() {
    return this.aiService.getAnalyticsStats();
  }

  // ─── AI Knowledge Graph (Idea #8) ─────────────────────────────────────

  @Get('knowledge/graph')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy knowledge graph (nodes + edges)' })
  async getKnowledgeGraph(
    @Query('node_types') nodeTypes?: string,
    @Query('limit') limit?: string,
  ) {
    const types = nodeTypes ? nodeTypes.split(',').map(t => t.trim()) : undefined;
    return this.aiService.getKnowledgeGraph(types, limit ? parseInt(limit, 10) : 500);
  }

  @Post('knowledge/query')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Query knowledge graph (1-degree traversal)' })
  async queryKnowledgeGraph(
    @Body('node_id') nodeId: string,
    @Body('edge_types') edgeTypes?: string[],
    @Body('depth') depth?: number,
    @Body('limit') limit?: number,
  ) {
    if (!nodeId) {
      return { start_node: null, neighbors: [], edges: [], meta: { error: 'node_id is required' } };
    }
    return this.aiService.queryKnowledgeGraph(nodeId, edgeTypes, depth ?? 1, limit ?? 50);
  }

  @Post('knowledge/suggest-partners')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gợi ý nhà tài trợ/đối tác phù hợp từ knowledge graph' })
  async suggestPartners(
    @Body('query') query: string,
    @Body('limit') limit?: number,
    @Body('focus_type') focusType?: string,
  ) {
    if (!query) {
      return { query: '', count: 0, suggestions: [] };
    }
    return this.aiService.suggestKnowledgePartners(query, limit ?? 10, focusType);
  }

  @Post('knowledge/extract')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'NLP entity extraction (knowledge graph)' })
  async extractEntities(@Body('text') text: string) {
    if (!text) {
      return { entities: [], linked_nodes: [], confidence: 0, degraded: true };
    }
    return this.aiService.extractEntities(text);
  }

  @Post('knowledge/sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đồng bộ knowledge graph từ DB sang AI service' })
  async syncKnowledgeGraph(@Body('background') background?: boolean) {
    return this.aiService.triggerKnowledgeGraphSync(background ?? true);
  }

  // ─── AI Language Bridge (Idea #15) ──────────────────────────────────

  @Post('language/simplify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-15: Đơn giản hóa văn bản theo trình độ độ khó (LLM)' })
  async simplifyText(
    @Body('text') text: string,
    @Body('difficulty') difficulty?: string,
    @Body('context') context?: string,
  ) {
    if (!text || !text.trim()) {
      return { simplified: '', explained_terms: {}, degraded: true,
               reason: 'Văn bản không được để trống.', difficulty: difficulty || 'middle' };
    }
    return this.aiService.simplifyText(text, difficulty || 'middle', context);
  }

  @Post('language/translate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-15: Dịch văn bản có bảng thuật ngữ (LLM)' })
  async translateText(
    @Body('text') text: string,
    @Body('target_language') targetLanguage?: string,
    @Body('source_language') sourceLanguage?: string,
    @Body('glossary') glossary?: Record<string, string>,
  ) {
    if (!text || !text.trim()) {
      return { translated: '', detected_source: sourceLanguage || null, degraded: true,
               reason: 'Văn bản không được để trống.', target_language: targetLanguage || 'en' };
    }
    return this.aiService.translateText(text, targetLanguage || 'en', sourceLanguage, glossary);
  }

  @Post('language/tts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-15: Chuyển đổi văn bản thành giọng nói (TTS)' })
  async synthesizeSpeech(
    @Body('text') text: string,
    @Body('language') language?: string,
    @Body('voice') voice?: string,
  ) {
    if (!text || !text.trim()) {
      return { audio_base64: null, audio_format: 'mp3', duration_ms: 0,
               provider: null, degraded: true,
               reason: 'Văn bản không được để trống.', language: language || 'vi' };
    }
    return this.aiService.synthesizeSpeech(text, language || 'vi', voice);
  }

  // ─── Voice-to-Geo AI (Idea #16) — server-side STT fallback ──────────

  /**
   * POST /ai/speech/to-text
   *
   * Server-side Speech-to-Text fallback (Whisper via XKIRO). The frontend
   * prefers the client-side Web Speech API (privacy); this endpoint is called
   * when the browser cannot transcribe Vietnamese reliably.
   *
   * Requires: XKIRO_API_KEY (HF Spaces secret).
   * Degrades gracefully: returns 200 with degraded=True when Whisper is
   * unavailable, so the frontend falls back to the client-side transcript.
   *
   * Source: https://docs.xkiro.com/api/api-reference/stt/create-transcription.md
   */
  @Post('speech/to-text')
  @ApiOperation({ summary: 'F-16: Server-side STT fallback (Whisper via XKIRO)' })
  async speechToText(
    @Body('audio_base64') audioBase64: string,
    @Body('audio_format') audioFormat?: string,
    @Body('language') language?: string,
  ) {
    return this.aiService.speechToText({
      audio_base64: audioBase64,
      audio_format: audioFormat,
      language: language,
    });
  }
}
