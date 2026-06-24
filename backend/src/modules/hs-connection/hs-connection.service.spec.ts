import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HsConnectionService } from './hs-connection.service';
import { Repository } from 'typeorm';
import { UniversityCounseling } from './entities/hs.entity';
import { StudentConnection } from './entities/student-connection.entity';
import { HsQuestion, HsAnswer } from './entities/hs-qa.entity';
import { User } from '../auth/entities/user.entity';

describe('HsConnectionService', () => {
  let service: HsConnectionService;
  let hsRepo: Repository<UniversityCounseling>;
  let connectionRepo: Repository<StudentConnection>;
  let questionRepo: Repository<HsQuestion>;
  let answerRepo: Repository<HsAnswer>;
  let userRepo: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HsConnectionService,
        {
          provide: getRepositoryToken(UniversityCounseling),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StudentConnection),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(HsQuestion),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(HsAnswer),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HsConnectionService>(HsConnectionService);
    hsRepo = module.get<Repository<UniversityCounseling>>(getRepositoryToken(UniversityCounseling));
    connectionRepo = module.get<Repository<StudentConnection>>(getRepositoryToken(StudentConnection));
    questionRepo = module.get<Repository<HsQuestion>>(getRepositoryToken(HsQuestion));
    answerRepo = module.get<Repository<HsAnswer>>(getRepositoryToken(HsAnswer));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCounselingInfo', () => {
    it('should create and save counseling info', async () => {
      const mockData = {
        university_name: 'MIT',
        program_info: 'Top school',
        contact_email: 'info@mit.edu',
        admission_criteria: { gpa: 3.5 },
      };
      const saved = { id: 'uc-1', ...mockData, created_at: new Date() };
      jest.spyOn(hsRepo, 'create').mockReturnValue(saved as UniversityCounseling);
      jest.spyOn(hsRepo, 'save').mockResolvedValue(saved as UniversityCounseling);

      const result = await service.createCounselingInfo(mockData);

      expect(hsRepo.create).toHaveBeenCalledWith(mockData);
      expect(result).toEqual(saved);
    });
  });

  describe('getCounselingList', () => {
    it('should return list of counseling info', async () => {
      const mockList = [
        { id: 'uc-1', university_name: 'MIT', program_info: 'Info 1' },
        { id: 'uc-2', university_name: 'Stanford', program_info: 'Info 2' },
      ];
      jest.spyOn(hsRepo, 'find').mockResolvedValue(mockList as UniversityCounseling[]);

      const result = await service.getCounselingList();

      expect(result).toHaveLength(2);
      expect(result[0].university_name).toBe('MIT');
    });

    it('should order by created_at DESC', async () => {
      jest.spyOn(hsRepo, 'find').mockResolvedValue([]);

      await service.getCounselingList();

      expect(hsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { created_at: 'DESC' } }),
      );
    });
  });

  describe('registerCampusTour', () => {
    it('should return tour registration response', async () => {
      const result = await service.registerCampusTour('student-1', 'Harvard');

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.university).toBe('Harvard');
      expect(result.student_id).toBe('student-1');
      expect(result.tour_id).toMatch(/^TOUR-\d+$/);
      expect(result.message).toContain('Virtual Campus Tour');
    });
  });

  describe('createQuestion', () => {
    it('should create a new QA question', async () => {
      const mockQuestion = {
        id: 'q-1',
        student_id: 'student-1',
        title: 'How to apply?',
        content: 'I need help with application.',
        university_target: 'MIT',
      };
      jest.spyOn(questionRepo, 'create').mockReturnValue(mockQuestion as HsQuestion);
      jest.spyOn(questionRepo, 'save').mockResolvedValue(mockQuestion as HsQuestion);

      const result = await service.createQuestion('student-1', {
        title: 'How to apply?',
        content: 'I need help with application.',
        university_target: 'MIT',
      });

      expect(questionRepo.create).toHaveBeenCalledWith({
        student_id: 'student-1',
        title: 'How to apply?',
        content: 'I need help with application.',
        university_target: 'MIT',
      });
      expect(result).toEqual(mockQuestion);
    });
  });

  describe('getQuestions', () => {
    it('should return questions optionally filtered by university', async () => {
      const mockQuestions = [
        { id: 'q-1', title: 'MIT Q', university_target: 'MIT', answers: [] },
      ];
      jest.spyOn(questionRepo, 'find').mockResolvedValue(mockQuestions as HsQuestion[]);

      const result = await service.getQuestions('MIT');

      expect(questionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { university_target: 'MIT' },
          relations: ['student', 'answers', 'answers.mentor'],
        }),
      );
      expect(result).toContainEqual(expect.objectContaining({ title: 'MIT Q' }));
    });

    it('should return all questions when no university filter', async () => {
      jest.spyOn(questionRepo, 'find').mockResolvedValue([]);

      await service.getQuestions();

      expect(questionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  describe('answerQuestion', () => {
    it('should create and save an answer for an existing question', async () => {
      jest.spyOn(questionRepo, 'findOne').mockResolvedValue({ id: 'q-1' } as HsQuestion);
      const mockAnswer = {
        id: 'a-1',
        mentor_id: 'mentor-1',
        question_id: 'q-1',
        content: 'Here is the answer.',
        is_verified_answer: false,
      };
      jest.spyOn(answerRepo, 'create').mockReturnValue(mockAnswer as HsAnswer);
      jest.spyOn(answerRepo, 'save').mockResolvedValue(mockAnswer as HsAnswer);

      const result = await service.answerQuestion('mentor-1', 'q-1', 'Here is the answer.');

      expect(answerRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockAnswer);
    });

    it('should throw NotFoundException when question does not exist', async () => {
      jest.spyOn(questionRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.answerQuestion('mentor-1', 'invalid-q', 'answer'),
      ).rejects.toThrow('Câu hỏi không tồn tại');
    });
  });

  describe('sendConnectionRequest', () => {
    it('should create connection request between students', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue({ id: 'receiver-1' } as User);
      jest.spyOn(connectionRepo, 'findOne').mockResolvedValue(null);
      const mockConnection = {
        id: 'conn-1',
        requester_id: 'sender-1',
        receiver_id: 'receiver-1',
        status: 'pending',
      };
      jest.spyOn(connectionRepo, 'create').mockReturnValue(mockConnection as StudentConnection);
      jest.spyOn(connectionRepo, 'save').mockResolvedValue(mockConnection as StudentConnection);

      const result = await service.sendConnectionRequest('sender-1', 'receiver-1');

      expect(connectionRepo.save).toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });

    it('should throw error when requester equals receiver', async () => {
      await expect(
        service.sendConnectionRequest('user-1', 'user-1'),
      ).rejects.toThrow('Không thể gửi yêu cầu cho chính mình');
    });

    it('should throw error when receiver does not exist', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.sendConnectionRequest('sender-1', 'nonexistent'),
      ).rejects.toThrow('Người dùng không tồn tại');
    });

    it('should throw error when connection already exists', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue({ id: 'receiver-1' } as User);
      jest.spyOn(connectionRepo, 'findOne').mockResolvedValue({
        id: 'existing-conn',
        requester_id: 'sender-1',
        receiver_id: 'receiver-1',
      } as StudentConnection);

      await expect(
        service.sendConnectionRequest('sender-1', 'receiver-1'),
      ).rejects.toThrow('Yêu cầu đã tồn tại hoặc đã là bạn bè');
    });
  });

  describe('respondToConnectionRequest', () => {
    it('should update connection status to accepted', async () => {
      const existingConn = {
        id: 'req-1',
        receiver_id: 'user-1',
        status: 'pending',
      };
      jest.spyOn(connectionRepo, 'findOne').mockResolvedValue(existingConn as StudentConnection);
      jest.spyOn(connectionRepo, 'save').mockImplementation((conn) => Promise.resolve(conn as StudentConnection));

      const result = await service.respondToConnectionRequest('user-1', 'req-1', true);

      expect(result.status).toBe('accepted');
      expect(connectionRepo.save).toHaveBeenCalled();
    });

    it('should update connection status to rejected', async () => {
      const existingConn = {
        id: 'req-2',
        receiver_id: 'user-1',
        status: 'pending',
      };
      jest.spyOn(connectionRepo, 'findOne').mockResolvedValue(existingConn as StudentConnection);
      jest.spyOn(connectionRepo, 'save').mockImplementation((conn) => Promise.resolve(conn as StudentConnection));

      const result = await service.respondToConnectionRequest('user-1', 'req-2', false);

      expect(result.status).toBe('rejected');
    });

    it('should throw error when request not found', async () => {
      jest.spyOn(connectionRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.respondToConnectionRequest('user-1', 'invalid-req', true),
      ).rejects.toThrow('Không tìm thấy yêu cầu');
    });
  });

  describe('getMyNetwork', () => {
    it('should return friends and pending requests', async () => {
      const mockFriends = [
        { id: 'c-1', requester_id: 'user-1', receiver_id: 'friend-1', requester: { id: 'friend-1', full_name: 'Friend A' }, receiver: { id: 'user-1', full_name: 'Me' } },
        { id: 'c-2', requester_id: 'friend-2', receiver_id: 'user-1', requester: { id: 'user-1', full_name: 'Me' }, receiver: { id: 'friend-2', full_name: 'Friend B' } },
      ];
      const mockRequests = [
        { id: 'c-3', requester_id: 'receiver-1', receiver_id: 'user-1', status: 'pending', requester: { id: 'receiver-1', full_name: 'Requester A' } },
      ];
      jest.spyOn(connectionRepo, 'find')
        .mockImplementationOnce(() => Promise.resolve(mockFriends as StudentConnection[]))
        .mockImplementationOnce(() => Promise.resolve(mockRequests as StudentConnection[]));

      const result = await service.getMyNetwork('user-1');

      expect(result).toBeDefined();
      expect(result.friends).toHaveLength(2);
      expect(result.requests).toHaveLength(1);
    });
  });
});
