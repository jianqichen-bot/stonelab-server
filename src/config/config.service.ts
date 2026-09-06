import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import { validateEnvironment } from './environment.js';

@Injectable()
export class ConfigService {
  private readonly values: Record<string, unknown> = validateEnvironment(process.env);

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.values[key] as T | undefined) ?? defaultValue;
  }

  getOrThrow<T>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }
}
