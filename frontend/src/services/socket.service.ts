import { io, Socket } from 'socket.io-client';
import { authService } from './auth.service';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (this.socket?.connected) return;

    // Connect to the realtime namespace
    this.socket = io('/realtime', {
      path: '/api/socket.io', // Nginx will proxy this
      transports: ['websocket'],
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