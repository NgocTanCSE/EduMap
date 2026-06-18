import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { Event } from './entities/event.entity';
import { Repository } from 'typeorm';

describe('EventsService', () => {
  let service: EventsService;
  let repo: Repository<Event>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getRepositoryToken(Event),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    repo = module.get<Repository<Event>>(getRepositoryToken(Event));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEvents', () => {
    it('should return array of events', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'React Workshop', type: 'workshop' },
        { id: 'event-2', title: 'AI Hackathon', type: 'hackathon' },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockEvents as Event[]);

      const result = await service.getEvents();

      expect(result).toEqual(mockEvents);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('getEventById', () => {
    it('should return event when found', async () => {
      const mockEvent = { id: 'event-1', title: 'React Workshop', type: 'workshop' };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockEvent as Event);

      const result = await service.getEventById('event-1');

      expect(result).toEqual(mockEvent);
    });

    it('should throw error when event not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.getEventById('nonexistent')).rejects.toThrow();
    });
  });

  describe('createEvent', () => {
    it('should create new event', async () => {
      const mockEvent = { id: 'event-1', title: 'New Event', type: 'workshop' };
      jest.spyOn(repo, 'create').mockReturnValue(mockEvent as Event);
      jest.spyOn(repo, 'save').mockResolvedValue(mockEvent as Event);

      const result = await service.createEvent({
        title: 'New Event',
        description: 'Event description',
        type: 'workshop',
        start_date: '2026-07-15T09:00:00+07:00',
        end_date: '2026-07-15T17:00:00+07:00',
      });

      expect(result).toEqual(mockEvent);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
