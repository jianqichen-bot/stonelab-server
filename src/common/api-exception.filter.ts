import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Prisma } from '../generated/prisma/client.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const status = this.getStatus(exception);
    const exceptionBody = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = this.getMessage(exceptionBody, exception);

    void response.status(status).send({
      code: status,
      data: null,
      error: message,
      message,
    });
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') return HttpStatus.NOT_FOUND;
      if (exception.code === 'P2002' || exception.code === 'P2003') return HttpStatus.CONFLICT;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getMessage(body: string | object | undefined, exception: unknown): string {
    if (typeof body === 'string') return body;
    if (body && 'message' in body) {
      const value = (body as { message: string | string[] }).message;
      return Array.isArray(value) ? value.join('; ') : value;
    }
    return exception instanceof Error ? exception.message : 'Internal server error';
  }
}
