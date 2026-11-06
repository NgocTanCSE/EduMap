import apiService from './api';


export interface BookingSlot {
  start: string;
  end: string;
}

export const mentorService = {
  async getMentors(params: { q?: string; specialty?: string; min_rating?: number } = {}) {
    return apiService.getMentors(params);
  },

  async getMentor(id: string) {
    return apiService.getMentor(id);
  },

  async getSlots(mentorId: string, date?: string) {
    return apiService.getMentorSlots(mentorId, date ? { date } : undefined);
  },

  async recommend(userId: string) {
    return apiService.recommendMentors(userId);
  },

  async bookSession(mentorId: string, slot: BookingSlot, notes?: string) {
    const payload = {
      mentorId,
      slot: {
        start: new Date(slot.start).toISOString(),
        end: new Date(slot.end).toISOString(),
      },
      notes,
    };
    return apiService.bookSession(payload);
  },

  async getMyBookings() {
    return apiService.getMyBookings();
  },

  async updateBookingStatus(bookingId: string, status: 'pending' | 'confirmed' | 'cancelled' | 'completed') {
    return apiService.updateBookingStatus(bookingId, status);
  },
};

export default mentorService;
