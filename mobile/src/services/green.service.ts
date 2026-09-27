import apiService from './api';

/**
 * Green service (mirrors web FE: frontend/src/services/green.service.ts).
 * Logs a challenge activity with carbon saved, and reads impacts.
 */
export const greenService = {
  async getChallenges() {
    return apiService.getChallenges();
  },

  async logActivity(payload: { challengeId: string; carbonSavedKg?: number }) {
    // Backend DTO uses challenge_id; map from FE-style camelCase.
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
