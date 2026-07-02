import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;
    const rawMessage = typeof exceptionResponse === 'object' && exceptionResponse && 'message' in exceptionResponse
      ? (exceptionResponse as any).message
      : exception instanceof Error && status < HttpStatus.INTERNAL_SERVER_ERROR
        ? exception.message
        : 'Lỗi máy chủ nội bộ.';
    const message = Array.isArray(rawMessage) ? rawMessage.join(' ') : rawMessage;

    // Server-side (5xx) faults are unexpected bugs/outages: log the full error + stack so they are
    // diagnosable. Client errors (4xx) are expected control flow and stay quiet to avoid log noise.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const detail = exception instanceof Error ? exception.stack || exception.message : String(exception);
      this.logger.error(`[${request.method} ${request.url}] ${detail}`);
    }

    // Nest can receive object responses in HttpException. Preserve them instead of coercing to a
    // plain string so API clients can still read structured error codes when present.
    const code =
      typeof exceptionResponse === 'object' && exceptionResponse && 'code' in exceptionResponse
        ? (exceptionResponse as any).code
        : undefined;

    response.status(status).json({
      success: false,
      statusCode: status,
      ...(code ? { code } : {}),
      message: message || 'Yêu cầu không hợp lệ.',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
