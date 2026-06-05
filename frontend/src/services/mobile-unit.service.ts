import { authService } from './auth.service';

export interface MobileUnitRoute {
  id: string;
  mobile_unit_id: string;
  destination_name: string;
  location: any;
  scheduled_at: string;
  status: string;
}

export interface MobileUnit {
  id: string;
  name: string;
  description: string;
  vehicle_plate: string;
  current_location: any;
  status: string;
}

export interface UnitScheduleResponse {
  unit_info: MobileUnit;
  resources: string[];
  upcoming_routes: MobileUnitRoute[];
}

class MobileUnitService {
  private readonly API_URL = '/api/mobile-config'; // Keep existing API path

  /**
   * Lấy danh sách các xe tri thức lưu động
   */
  async getUnits(): Promise<MobileUnit[]> {
    try {
      const response = await fetch(`${this.API_URL}/units`);
      if (!response.ok) throw new Error('Không thể tải danh sách xe tri thức');
      return await response.json();
    } catch (error) {
      console.error("MobileUnitService.getUnits Error:", error);
      throw error;
    }
  }

  /**
   * Lấy lịch trình chi tiết của một xe
   */
  async getUnitSchedule(id: string): Promise<UnitScheduleResponse> {
    try {
      const response = await fetch(`${this.API_URL}/units/${id}/schedule`);
      if (!response.ok) throw new Error('Không thể tải lịch trình xe');
      return await response.json();
    } catch (error) {
      console.error(`MobileUnitService.getUnitSchedule Error:`, error);
      throw error;
    }
  }
}

export const mobileUnitService = new MobileUnitService();
