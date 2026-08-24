import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { AttachCorpusElementDto, ReattachCorpusElementDto, UpdateCorpusElementDto } from '../dto/referential-engine.dto';
import {
  AttachCorpusElementUseCase,
  QueryCorpusElementsUseCase,
  ReattachCorpusElementUseCase,
  UpdateCorpusElementUseCase,
} from '../../../application/use-cases/corpus-element.use-cases';
import {
  CorpusElementCircularParentError,
  CorpusElementParentNotInSameCorpusError,
} from '../../../domain/entities/corpus-element.entity';

@Controller({ path: 'referential-engine/corpus-elements', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('kernel.admin')
export class CorpusElementController {
  constructor(
    private readonly attachCorpusElementUseCase: AttachCorpusElementUseCase,
    private readonly updateCorpusElementUseCase: UpdateCorpusElementUseCase,
    private readonly reattachCorpusElementUseCase: ReattachCorpusElementUseCase,
    private readonly queryCorpusElementsUseCase: QueryCorpusElementsUseCase,
  ) {}

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const element = await this.queryCorpusElementsUseCase.getById(id);
    return element.toSnapshot();
  }

  @Get()
  async listByCorpus(@Query('corpusVersionneId', ParseUUIDPipe) corpusVersionneId: string) {
    const elements = await this.queryCorpusElementsUseCase.listByCorpus(corpusVersionneId);
    return elements.map((e) => e.toSnapshot());
  }

  @Get(':id/enfants')
  async listChildren(@Param('id', ParseUUIDPipe) id: string) {
    const enfants = await this.queryCorpusElementsUseCase.listChildren(id);
    return enfants.map((e) => e.toSnapshot());
  }

  @Post()
  @UseInterceptors(AuditInterceptor)
  @AuditAction('corpus_element.created')
  async attach(@Body() dto: AttachCorpusElementDto) {
    try {
      return await this.attachCorpusElementUseCase.execute(dto);
    } catch (error) {
      if (error instanceof CorpusElementParentNotInSameCorpusError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Patch(':id')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('corpus_element.updated')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCorpusElementDto,
  ): Promise<{ success: true }> {
    await this.updateCorpusElementUseCase.execute(id, dto);
    return { success: true };
  }

  @Post(':id/reattach')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('corpus_element.reattached')
  async reattach(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReattachCorpusElementDto,
  ): Promise<{ success: true }> {
    try {
      await this.reattachCorpusElementUseCase.execute(id, dto.nouveauParentId ?? null);
      return { success: true };
    } catch (error) {
      if (
        error instanceof CorpusElementParentNotInSameCorpusError ||
        error instanceof CorpusElementCircularParentError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
