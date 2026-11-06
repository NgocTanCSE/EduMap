import { authService } from './auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export interface InternationalProgram {
    id: string;
    title: string;
    type: string;
    description: string;
    host_country: string;
    organization: string;
    application_deadline: string;
    benefits: string[];
    apply_url: string;
    created_at: string;
}
export interface AlumniNetwork {
    id: string;
    full_name: string;
    university: string;
    country: string;
    major: string;
    location: any;
    contact_email: string;
    status: string;
    created_at: string;
}
class IntlService {
    private readonly API_URL = '/api/intl';
    async getPrograms(type?: string): Promise<InternationalProgram[]> {
        try {
            const url = type ? `${this.API_URL}/programs?type=${type}` : `${this.API_URL}/programs`;
            const response = await fetchWithRetry(url);
            if (!response.ok)
                throw new Error('Không thể tải danh sách chương trình quốc tế');
            return unwrapApiResponse<any>(await response.json());
        }
        catch (error) {
            console.error("IntlService.getPrograms Error:", error);
            throw error;
        }
    }
    async getAlumni(): Promise<AlumniNetwork[]> {
        try {
            const response = await fetchWithRetry(`${this.API_URL}/alumni`);
            if (!response.ok)
                throw new Error('Không thể tải mạng lưới cựu sinh viên');
            return unwrapApiResponse<any>(await response.json());
        }
        catch (error) {
            console.error("IntlService.getAlumni Error:", error);
            throw error;
        }
    }
    async getAlumniNearby(lat: number, lng: number, radius?: number): Promise<AlumniNetwork[]> {
        try {
            let url = `${this.API_URL}/alumni/nearby?latitude=${lat}&longitude=${lng}`;
            if (radius)
                url += `&radius=${radius}`;
            const response = await fetchWithRetry(url);
            if (!response.ok)
                throw new Error('Không thể tìm kiếm lưu học sinh lân cận');
            return unwrapApiResponse<any>(await response.json());
        }
        catch (error) {
            console.error("IntlService.getAlumniNearby Error:", error);
            throw error;
        }
    }
    async registerAlumni(data: any): Promise<any> {
        const token = authService.getAccessToken();
        if (!token)
            throw new Error('Vui lòng đăng nhập để đăng ký mạng lưới');
        try {
            const response = await fetchWithRetry(`${this.API_URL}/alumni`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.message || 'Đăng ký mạng lưới thất bại');
            return result;
        }
        catch (error) {
            console.error("IntlService.registerAlumni Error:", error);
            throw error;
        }
    }
}
export const intlService = new IntlService();
