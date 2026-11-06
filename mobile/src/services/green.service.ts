import apiService from './api';


export const greenService = {
  async getChallenges() {
    return apiService.getChallenges();
  },

  async logActivity(payload: { challengeId: string; carbonSavedKg?: number }) {

    return apiService.logActivity({
      challengeId: payload.challengeId,
      carbonSavedKg: payload.carbonSavedKg,
    });
  },

  async getMyActivities() {
    return apiService.getMyActivities();
  },

  async getImpacts() {
    return apiService.getGreenImpacts();
  },

  async logImpact(payload: { initiative: string; carbon_saved_kg: number; date: string }) {
    return apiService.logImpact(payload);
  },
};

export default greenService;
