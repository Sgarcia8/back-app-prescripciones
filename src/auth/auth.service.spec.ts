import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
    decode: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('throws ConflictException when email exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'taken@test.com' });

      await expect(
        service.register({
          email: 'taken@test.com',
          password: 'password123',
          name: 'Dup',
          role: 'doctor',
          speciality: 'General',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates doctor with nested doctor profile', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 2,
        email: 'dr@new.com',
        password: 'hashed',
        name: 'Dr New',
        role: Role.doctor,
        doctor: { id: 1, userId: 2, speciality: 'Cardio' },
        patient: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.register({
        email: 'dr@new.com',
        password: 'password123',
        name: 'Dr New',
        role: 'doctor',
        speciality: 'Cardio',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'dr@new.com',
            name: 'Dr New',
            role: Role.doctor,
            doctor: { create: { speciality: 'Cardio' } },
          }),
        }),
      );
    });

    it('creates patient with nested patient and birthDate', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const birth = new Date('1991-06-01');
      prisma.user.create.mockResolvedValue({
        id: 3,
        email: 'pat@new.com',
        password: 'hashed',
        name: 'Pat New',
        role: Role.patient,
        doctor: null,
        patient: { id: 1, userId: 3, birthDate: birth },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.register({
        email: 'pat@new.com',
        password: 'password123',
        name: 'Pat New',
        role: 'patient',
        birthDate: birth,
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'pat@new.com',
            role: Role.patient,
            patient: { create: { birthDate: birth } },
          }),
        }),
      );
    });
  });

  describe('login', () => {
    it('throws when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nope@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws when password invalid', async () => {
      const hash = await bcrypt.hash('correct-pass', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'u@test.com',
        password: hash,
        role: Role.patient,
      });

      await expect(
        service.login({ email: 'u@test.com', password: 'wrong-pass' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('returns tokens and stores refresh hash on success', async () => {
      const hash = await bcrypt.hash('secret', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 10,
        email: 'ok@test.com',
        password: hash,
        role: Role.doctor,
      });
      jwtService.signAsync
        .mockResolvedValueOnce('access-jwt')
        .mockResolvedValueOnce('refresh-jwt');
      jwtService.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: 'ok@test.com', password: 'secret' });

      expect(result).toEqual({ accessToken: 'access-jwt', refreshToken: 'refresh-jwt' });
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 10,
          }),
        }),
      );
    });
  });

  describe('refresh', () => {
    it('throws when verifyAsync fails', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(service.refresh({ refreshToken: 'bad' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('throws when refresh token row missing', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 1, role: Role.patient });
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: 'tok' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when stored token expired', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 1, role: Role.patient });
      prisma.refreshToken.findUnique.mockResolvedValue({
        tokenHash: 'x',
        userId: 1,
        expiresAt: new Date(0),
      });

      await expect(service.refresh({ refreshToken: 'tok' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns new access token when refresh valid', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 2, role: Role.doctor });
      prisma.refreshToken.findUnique.mockResolvedValue({
        tokenHash: 'x',
        userId: 2,
        expiresAt: new Date(Date.now() + 86400000),
      });
      jwtService.signAsync.mockResolvedValue('new-access');

      const result = await service.refresh({ refreshToken: 'valid-refresh' });

      expect(result).toEqual({ accessToken: 'new-access' });
      expect(jwtService.signAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('profile', () => {
    it('throws when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.profile(999)).rejects.toThrow(UnauthorizedException);
    });
  });
});
