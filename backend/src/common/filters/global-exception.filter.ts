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

    // Preserve a machine-readable error code when the thrower supplied one (e.g.
    // STEPUP_SESSION_REQUIRED). The frontend axios interceptor keys off this code to transparently
    // open a face-scan and replay the request — dropping it silently breaks the entire step-up flow.
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
