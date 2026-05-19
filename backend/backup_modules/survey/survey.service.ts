import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Survey, SurveyResponse } from './entities/survey.entity';

@Injectable()
export class SurveyService {
  constructor(
    @InjectRepository(Survey) private surveyRepo: Repository<Survey>,
    @InjectRepository(SurveyResponse) private responseRepo: Repository<SurveyResponse>,
  ) {}

  // 1. Thu th?p d? li?u (Collect responses)
  async submitResponse(surveyId: string, userId: string, answers: any) {
    const survey = await this.surveyRepo.findOne({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException('SUR_001: Survey not found');

    const response = this.responseRepo.create({
      survey_id: surveyId,
      user_id: userId,
      answers: answers
    });
    return this.responseRepo.save(response);
  }

  // 2. Phân tích d? li?u (Analytics & Reports)
  async analyzeSurvey(surveyId: string) {
    const responses = await this.responseRepo.find({ where: { survey_id: surveyId } });
    
    // Logic gi? l?p phân tích câu tr? l?i (Ví d?: ð?m s? lý?ng l?a ch?n)
    const analytics = {
      total_responses: responses.length,
      completion_rate: '85%',
      insights: [
        { question: 'M?c ð? hài l?ng', average_score: 4.5 },
        { question: 'Khó khãn l?n nh?t', top_answer: 'Tài chính' }
      ]
    };
    return analytics;
  }

  // 3. Xu?t d? li?u (Export)
  async exportData(surveyId: string, format: string = 'csv') {
    // Trong th?c t? s? s? d?ng thý vi?n nhý json2csv ho?c exceljs ð? t?o file
    const responses = await this.responseRepo.find({ where: { survey_id: surveyId } });
    return {
      success: true,
      message: Ð? chu?n b? file export ð?nh d?ng \,
      download_url: https://api.edumap.app/exports/survey_\.\
    };
  }
}

