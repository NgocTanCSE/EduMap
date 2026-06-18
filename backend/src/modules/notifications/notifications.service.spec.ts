import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { Repository } from 'typeorm';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: Repository<Notification>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    repo = module.get<Repository<Notification>>(getRepositoryToken(Notification));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getNotifications', () => {
    it('should return array of notifications', async () => {
      const mockNotifs = [
        { id: 'notif-1', title: 'New Message', is_read: false },
        { id: 'notif-2', title: 'Event Reminder', is_read: true },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockNotifs as Notification[]);

      const result = await service.getNotifications('user-1');

      expect(result).toEqual(mockNotifs);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('sendNotification', () => {
    it('should create new notification', async () => {
      const mockNotif = { id: 'notif-1', title: 'New Notification', is_read: false };
      jest.spyOn(repo, 'create').mockReturnValue(mockNotif as Notification);
      jest.spyOn(repo, 'save').mockResolvedValue(mockNotif as Notification);

      const result = await service.sendNotification({
        user_id: 'user-1',
        title: 'New Notification',
        body: 'You have a new message',
        channel: 'in_app',
      });

      expect(result).toEqual(mockNotif);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockNotif = { id: 'notif-1', is_read: false };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockNotif as Notification);
      jest.spyOn(repo, 'save').mockResolvedValue({ ...mockNotif, is_read: true } as Notification);

      const result = await service.markAsRead('notif-1');

      expect(result.is_read).toBe(true);
    });
  });
});
