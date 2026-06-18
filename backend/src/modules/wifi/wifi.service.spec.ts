import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WifiService } from './wifi.service';
import { WifiLocation } from './entities/wifi.entity';
import { Repository } from 'typeorm';

describe('WifiService', () => {
  let service: WifiService;
  let repo: Repository<WifiLocation>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WifiService,
        {
          provide: getRepositoryToken(WifiLocation),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WifiService>(WifiService);
    repo = module.get<Repository<WifiLocation>>(getRepositoryToken(WifiLocation));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLocations', () => {
    it('should return array of wifi locations', async () => {
      const mockLocations = [
        { id: 'wifi-1', name: 'Cafe WiFi', is_free: true },
        { id: 'wifi-2', name: 'Library WiFi', is_free: true },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockLocations as WifiLocation[]);

      const result = await service.getLocations();

      expect(result).toEqual(mockLocations);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('reportLocation', () => {
    it('should create new wifi location', async () => {
      const mockLocation = { id: 'wifi-1', name: 'New WiFi', is_free: true };
      jest.spyOn(repo, 'create').mockReturnValue(mockLocation as WifiLocation);
      jest.spyOn(repo, 'save').mockResolvedValue(mockLocation as WifiLocation);

      const result = await service.reportLocation({
        name: 'New WiFi',
        is_free: true,
        longitude: 107.1825,
        latitude: 10.9567,
        reported_by: 'user-1',
      });

      expect(result).toEqual(mockLocation);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
