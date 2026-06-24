export function getBackendUrl(): string {
  const nextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const apiUrl = process.env.API_URL;

  if (nextPublicApiUrl) {
    return nextPublicApiUrl;
  }

  if (apiUrl) {
    return apiUrl;
  }

  return 'http://localhost:3000';
}
