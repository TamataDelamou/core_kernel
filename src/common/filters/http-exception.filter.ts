import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface NormalizedErrorBody {
  statusCode: number;
  errorId: string;
  message: string;
  path: string;
  timestamp: string;
}

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorId = uuidv4();
    const isHttpException = exception instanceof HttpException;

    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // OWASP: les détails d'erreur interne (stack, message brut d'exception non maîtrisée)
    // sont journalisés côté serveur avec un identifiant de corrélation, jamais renvoyés au client.
    const clientMessage = isHttpException
      ? this.extractClientMessage(exception)
      : 'Une erreur interne est survenue. Contactez le support avec l\'identifiant fourni.';

    const body: NormalizedErrorBody = {
      statusCode,
      errorId,
      message: clientMessage,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= 500) {
      this.logger.error(
        `[${errorId}] ${request.method} ${request.url} — ${
          exception instanceof Error ? exception.stack : String(exception)
        }`,
      );
    } else {
      this.logger.warn(`[${errorId}] ${request.method} ${request.url} — ${clientMessage}`);
    }

    response.status(statusCode).json(body);
  }

  private extractClientMessage(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response !== null && 'message' in response) {
      const message = (response as { message: unknown }).message;
      return Array.isArray(message) ? message.join(' ; ') : String(message);
    }
    return exception.message;
  }
}
