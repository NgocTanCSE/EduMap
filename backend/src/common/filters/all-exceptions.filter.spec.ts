import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { method: string; url: string; id?: string };
  let mockHost: unknown;

  beforeEach(() => {
    filter = new AllExceptionsFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      method: 'POST',
      url: '/api/predict',
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };

    // Suppress console output during tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should handle body-parser SyntaxError (mapped to BadRequestException) at debug level', () => {
    // NestJS maps Express body-parser SyntaxError -> BadRequestException(400)
    // The message pattern matches "Unexpected token ... is not valid JSON"
    const exception = new HttpException(
      'Unexpected token \'n\', "not json" is not valid JSON',
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost as unknown as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        path: '/api/predict',
        message: 'Unexpected token \'n\', "not json" is not valid JSON',
      }),
    );

    // Should NOT log as warning — body-parser errors are probe/scanner traffic
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    warnSpy.mockClear();
    filter.catch(exception, mockHost as unknown as ArgumentsHost);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should log regular 400 errors as warnings', () => {
    const exception = new HttpException(
      'Email is already registered',
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost as unknown as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        path: '/api/predict',
        message: 'Email is already registered',
      }),
    );

    // Regular 400 errors SHOULD be logged as warnings
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    warnSpy.mockClear();
    filter.catch(exception, mockHost as unknown as ArgumentsHost);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should log 500 errors with full stack trace', () => {
    const exception = new Error('Database connection failed');
    const stack = exception.stack;

    filter.catch(exception, mockHost as unknown as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        path: '/api/predict',
        message: 'Internal server error',
      }),
    );

    expect(Logger.prototype.error).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('[anon] [POST] /api/predict'),
    );
    expect(Logger.prototype.error).toHaveBeenCalledWith(stack);
  });

  it('should detect "Unexpected end of JSON input" as body-parser error', () => {
    const exception = new HttpException(
      'Unexpected end of JSON input',
      HttpStatus.BAD_REQUEST,
    );

    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    filter.catch(exception, mockHost as unknown as ArgumentsHost);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Syntax]'),
    );
  });

  it('should include request id when available', () => {
    mockRequest.id = 'req-12345';

    const exception = new HttpException(
      'Unexpected token \'n\', "not json" is not valid JSON',
      HttpStatus.BAD_REQUEST,
    );

    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    filter.catch(exception, mockHost as unknown as ArgumentsHost);

    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('[req-12345]'),
    );
  });
});
