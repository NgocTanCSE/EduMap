import { io, Socket } from 'socket.io-client';
import { authService } from './auth.service';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (this.socket?.connected) return;

    // Resolve the backend base URL. On Vercel the frontend is served from a
    // different origin than the HF Space backend, so we must connect directly
    // to the HF Space (or an override) instead of the relative origin.
    const socketBase =
      (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BACKEND_URL) ||
      (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SOCKET_URL) ||
      (typeof window !== 'undefined' && window.location.origin.includes('vercel.app')
        ? 'https://tancse2005-edumap.hf.space'
        : '');

    // Connect to the realtime namespace
    this.socket = io(`${socketBase}/realtime`, {
      path: '/api/socket.io', // hf-proxy rewrites to /socket.io on the backend
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Connected to realtime gateway');
      // Identify user to join private room
      const user = authService.getUser();
      if (user) {
        this.socket?.emit('identity', user.id);
      }
    });

    this.socket.on('notify', (data: any) => {
      console.log('New notification:', data);
      // In a real app, we'd use a toast library like react-hot-toast
      // For now, we'll use a standard browser notification if permission granted
      this.showToast(data.title, data.body);
    });
  }

  private showToast(title: string, body: string) {
    // Custom event to be caught by a Toast component
    const event = new CustomEvent('edumap-notification', {
      detail: { title, body }
    });
    window.dispatchEvent(event);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketService = new SocketService();