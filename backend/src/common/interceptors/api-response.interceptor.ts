import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (request.url?.startsWith('/api/auth') || request.url?.startsWith('/auth')) {
      return next.handle();
    }
    if (request.headers?.accept?.includes('text/event-stream')) {
      return next.handle();
    }

    const message = this.resolveMessage(request.method);
    return next.handle().pipe(map((data) => ({ success: true, message, data })));
  }

  private resolveMessage(method: string) {
    const action =
      method === 'POST'
        ? 'Tạo dữ liệu thành công.'
        : method === 'PATCH'
          ? 'Cập nhật dữ liệu thành công.'
          : method === 'DELETE'
            ? 'Xóa dữ liệu thành công.'
            : 'Lấy dữ liệu thành công.';
    return action;
  }
}
