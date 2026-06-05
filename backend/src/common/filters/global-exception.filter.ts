import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
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

    response.status(status).json({
      success: false,
      statusCode: status,
      message: message || 'Yêu cầu không hợp lệ.',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
