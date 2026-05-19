import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternationalProgram } from './entities/intl.entity';

@Injectable()
export class IntlService {
  constructor(
    @InjectRepository(InternationalProgram)
    private intlRepository: Repository<InternationalProgram>,
  ) {}

  async findAll(type?: string) {
    const where = type ? { type } : {};
    return this.intlRepository.find({ where });
  }
}
