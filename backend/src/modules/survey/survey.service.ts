import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Survey } from './entities/survey.entity';
import { SurveyResponse } from './entities/survey-response.entity';
import { Parser } from 'json2csv';

@Injectable()
export class SurveyService {
  constructor(
    @InjectRepository(Survey) private readonly surveyRepo: Repository<Survey>,
    @InjectRepository(SurveyResponse) private readonly responseRepo: Repository<SurveyResponse>,
  ) {}

  async createSurvey(createdById: string, data: any) {
    const survey = this.surveyRepo.create({
      title: data.title,
      questions_json: data.questions || [],
      created_by_id: createdById,
      status: 'active',
    });
    return this.surveyRepo.save(survey);
  }

  async getSurveys() {
    return this.surveyRepo.find({
      where: { status: 'active' },
      order: { created_at: 'DESC' },
    });
  }

  async getSurveyById(id: string) {
    const survey = await this.surveyRepo.findOne({ where: { id } });
    if (!survey) throw new NotFoundException('Không tìm thấy cuộc khảo sát này');
    return survey;
  }

  async submitResponse(surveyId: string, userId: string, answers: any) {
    const survey = await this.surveyRepo.findOne({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException('Không tìm thấy cuộc khảo sát này');

    if (survey.status !== 'active') {
        throw new BadRequestException('Khảo sát này đã đóng.');
    }

    const existing = await this.responseRepo.findOne({
        where: { survey_id: surveyId, user_id: userId }
    });

    if (existing) {
        throw new BadRequestException('Bạn đã hoàn thành bài khảo sát này rồi.');
    }

    const response = this.responseRepo.create({
      survey_id: surveyId,
      user_id: userId,
      answers_json: answers,
    });
    
    await this.responseRepo.save(response);

    return { success: true, message: 'Cảm ơn bạn đã đóng góp ý kiến!' };
  }

  /**
   * Phân tích dữ liệu & Báo cáo kết quả thực tế
   */
  async analyzeSurvey(surveyId: string) {
    const survey = await this.surveyRepo.findOne({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException('Không tìm thấy cuộc khảo sát này');

    const responses = await this.responseRepo.find({ where: { survey_id: surveyId } });
    
    const stats = {
      survey_title: survey.title,
      total_responses: responses.length,
      questions_stats: [] as any[]
    };

    // Phân tích sơ bộ các câu hỏi trắc nghiệm
    if (survey.questions_json && Array.isArray(survey.questions_json)) {
      survey.questions_json.forEach((q: any, idx: number) => {
        if (q.type === 'rating' || q.type === 'choice') {
            const answers = responses.map(r => r.answers_json?.[q.id]).filter(a => a !== undefined);
            stats.questions_stats.push({
                question: q.text,
                response_count: answers.length,
                average: q.type === 'rating' ? (answers.reduce((s, a) => s + Number(a), 0) / answers.length).toFixed(1) : null
            });
        }
      });
    }

    return stats;
  }

  /**
   * Xuất dữ liệu khảo sát (Real CSV)
   */
  async exportData(surveyId: string, format: string = 'csv') {
    const survey = await this.surveyRepo.findOne({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException('Không tìm thấy cuộc khảo sát này');

    const responses = await this.responseRepo.find({ where: { survey_id: surveyId } });
    
    if (responses.length === 0) throw new BadRequestException('Không có dữ liệu để xuất');

    // Chuyển đổi dữ liệu sang dạng phẳng để CSV dễ đọc
    const data = responses.map(r => ({
      user_id: r.user_id,
      submitted_at: r.created_at,
      ...r.answers_json
    }));

    if (format === 'json') {
      return {
        success: true,
        filename: `survey-${surveyId}-${Date.now()}.json`,
        content: JSON.stringify(data, null, 2),
      };
    }

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);

    return {
      success: true,
      filename: `survey-${surveyId}-${Date.now()}.csv`,
      content: csv,
    };
  }
}
