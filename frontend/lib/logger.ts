export const logger = {
  info: (message: string, context?: any) => {
    console.info(`[INFO] ${new Date().toISOString()}: ${message}`, context || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error || '');
  },
  action: (actionName: string, details?: any) => {
    console.log(`[ACTION] ${new Date().toISOString()}: ${actionName}`, details || '');
  }
};
