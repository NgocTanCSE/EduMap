import { Injectable } from '@nestjs/common';

export interface GreenImpact {
  id: string;
  initiative: string;
  carbonSavedKg: number;
  date: string;
}

@Injectable()
export class GreenService {
  private greenImpacts: GreenImpact[] = []; // In-memory mock data
  private nextId = 1;

  constructor() {
    this.greenImpacts.push({ id: `impact-${this.nextId++}`, initiative: 'Digital Learning', carbonSavedKg: 500, date: '2023-01-15' });
    this.greenImpacts.push({ id: `impact-${this.nextId++}`, initiative: 'Waste Reduction Program', carbonSavedKg: 200, date: '2023-03-01' });
  }

  async getAllImpacts(): Promise<GreenImpact[]> {
    // In a real app, this would fetch data from a database
    return this.greenImpacts;
  }

  async getAllChallenges() {
    return [
      { id: 'chal-1', title: 'Zero Waste Week', description: 'No single-use plastics for a week', points: 100 },
      { id: 'chal-2', title: 'Bike to Work', description: 'Commute by bike for 5 days', points: 200 }
    ];
  }

  async addImpact(initiative: string, carbonSavedKg: number): Promise<GreenImpact> {
    const newImpact = { id: `impact-${this.nextId++}`, initiative, carbonSavedKg, date: new Date().toISOString().split('T')[0] };
    this.greenImpacts.push(newImpact);
    // In a real app, this would save to the database
    return newImpact;
  }
}
