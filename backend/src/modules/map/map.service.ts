import { Injectable } from '@nestjs/common';

export interface PointOfInterest {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
}

@Injectable()
export class MapService {
  private pois: PointOfInterest[] = []; // In-memory mock data

  constructor() {
    this.pois.push({ id: 'poi1', name: 'University A', category: 'Education', lat: 10.762622, lng: 106.660172 });
    this.pois.push({ id: 'poi2', name: 'Library B', category: 'Education', lat: 10.778891, lng: 106.699990 });
    this.pois.push({ id: 'poi3', name: 'Park C', category: 'Recreation', lat: 10.789123, lng: 106.700123 });
  }

  async findAllPois(): Promise<PointOfInterest[]> {
    // In a real app, this would fetch data from a database, possibly with spatial queries
    return this.pois;
  }

  async findPoisByCategory(category: string): Promise<PointOfInterest[]> {
    return this.pois.filter(poi => poi.category.toLowerCase() === category.toLowerCase());
  }
}
