import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { Role } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwt-payload';

@Injectable()
export class AuthService {
  private readonly accessSecret =
    process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me';
  private readonly refreshSecret =
    process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me';
  private readonly accessExpiresSec = Number(process.env.JWT_ACCESS_EXPIRES_SEC ?? 900);
  private readonly refreshExpiresSec = Number(process.env.JWT_REFRESH_EXPIRES_SEC ?? 604800);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private signAccess(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(
      { sub: payload.sub, role: payload.role },
      {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresSec,
      },
    );
  }

  private signRefresh(userId: number, role: Role): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, role },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresSec,
      },
    );
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const password = await bcrypt.hash(dto.password, 10);
    const role = dto.role as Role;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password,
        name: dto.name,
        role,
        ...(role === Role.doctor
          ? { doctor: { create: { speciality: dto.speciality } } }
          : { patient: { create: { birthDate: dto.birthDate ?? undefined } } }),
      },
      include: { doctor: true, patient: true },
    });

    const { password: _p, ...safe } = user;
    return safe;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.signAccess({ sub: user.id, role: user.role });
    const refreshToken = await this.signRefresh(user.id, user.role);

    const decoded = this.jwtService.decode(refreshToken) as { exp?: number } | null;
    const expiresAt =
      decoded?.exp != null ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 864e5);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashRefresh(refreshToken),
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async refresh(dto: RefreshDto) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const hash = this.hashRefresh(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
    });
    if (
      !stored ||
      stored.userId !== payload.sub ||
      stored.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = await this.signAccess({
      sub: payload.sub,
      role: payload.role,
    });
    return { accessToken };
  }

  async profile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        doctor: true,
        patient: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
