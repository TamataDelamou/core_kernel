import { Body, Controller, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/roles.decorator';
import { AuthenticatedRequestUser } from '../../../../common/guards/jwt-auth.guard';
import { ConfirmMfaEnrollmentDto } from '../dto/identity.dto';
import {
  ConfirmMfaEnrollmentUseCase,
  StartMfaEnrollmentUseCase,
} from '../../../application/use-cases/mfa.use-cases';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';

@Controller({ path: 'mfa', version: '1' })
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditInterceptor)
export class MfaController {
  constructor(
    private readonly startMfaEnrollmentUseCase: StartMfaEnrollmentUseCase,
    private readonly confirmMfaEnrollmentUseCase: ConfirmMfaEnrollmentUseCase,
  ) {}

  @Post('enroll/start')
  async startEnrollment(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.startMfaEnrollmentUseCase.execute(user.gsgId);
  }

  @Post('enroll/confirm')
  @AuditAction('mfa.enrolled')
  async confirmEnrollment(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: ConfirmMfaEnrollmentDto,
  ): Promise<{ success: true }> {
    await this.confirmMfaEnrollmentUseCase.execute(user.gsgId, dto.factorId, dto.code);
    return { success: true };
  }
}
